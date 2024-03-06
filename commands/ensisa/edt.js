const Discord = require('discord.js');
const puppeteer = require('puppeteer');
const fs = require('fs');

const { getColor } = require('../../utils/randomColor.js');
const {email, password} = require('../../json/login_uha.json');
const keysByRole = require('../../json/edt_keysByRole.json');

module.exports = {
    updateAllEDT,
    deleteEDTCache,
    fetchEDT,
	data: new Discord.SlashCommandBuilder()
        .addStringOption(option => option.setName('critere').setDescription('Group to search for (ex: 2ir7)').setRequired(false))
        .addStringOption(option => option.setName('date').setDescription('Date to search for (ex: 2021-10-01)').setRequired(false))
        .addStringOption(option => option.setName('increment').setDescription('Increment the date by the specified number of days (ex: 1, -1)').setRequired(false))
        .addBooleanOption(option => option.setName('semaine').setDescription('Search for full week if true, else search for current day').setRequired(false))
        .addStringOption(option => option.setName('special').setDescription('Search for special schedule').setRequired(false)
            .addChoices(
                { name: 'Prof', value: 'prof' },
				{ name: 'Salle', value: 'salle' },
            )
        )
        .addBooleanOption(option => option.setName('update').setDescription('Force update of the schedule').setRequired(false))
		.setName('edt')
		.setDescription('Sends the classes schedule of the specified day/week.')
		.setDMPermission(true),
	async execute(interaction) {
		await interaction.deferReply();
        fetchEDT({interaction: interaction});
	},
};

async function fetchEDT({interaction, channel, search_key, fullWeek = false, update = false, increment = 0}){
    let date = new Date();
    if (interaction) {
        if (interaction.options.getBoolean('semaine')) fullWeek = interaction.options.getBoolean('semaine');
        if (interaction.options.getString('date')) {
            const argDate = correctDateFormat(interaction.options.getString('date')); // add leading 0 to month and day if needed
            const argDateArray = argDate.split('-');
            if (!isValidDate(argDateArray[0], argDateArray[1], argDateArray[2])) return interaction.editReply("La date doit être au format YYYY-MM-DD");
            date = new Date(argDate);
            if (date == 'Invalid Date') return interaction.editReply("La date doit être au format YYYY-MM-DD");
        }
        else if (increment || interaction.options.getString('increment')) {
            if (!increment) increment = interaction.options.getString('increment');
            if (Number.parseInt(increment) == NaN) return interaction.editReply("L'incrément doit être un nombre");
            date.setDate(date.getDate() + Number.parseInt(increment));
        }

        // minDate : 14 août 2023
        // maxDate : 03 août 2024
        let minDate = new Date("2023-08-14");
        let maxDate = new Date("2024-08-03");
    
        if (date < minDate || date > maxDate) return interaction.editReply("La date doit être comprise entre le " + minDate.toISOString().split('T')[0] + " et le " + maxDate.toISOString().split('T')[0]);

        if (interaction.options.getBoolean('update')) update = interaction.options.getBoolean('update');
        if (interaction.options.getString('critere')) search_key = interaction.options.getString('critere');
        await interaction.member.fetch();
        interaction.member.roles.cache.forEach(role => {
            if (!search_key && keysByRole[role.id]) {
                search_key = keysByRole[role.id];
                return;
            }
        });
    }

    if (!interaction.options.getString('special')) return fetchEDTBasic({interaction: interaction, channel: channel, search_key: search_key, fullWeek: fullWeek, update: update, date: date});

    const special = interaction.options.getString('special');
    
    let allCoursesMap = await fetchAllCourses({interaction: interaction, channel: channel, search_key: search_key, fullWeek: fullWeek, update: update, date: date});

    switch (special) {
        case 'prof':
            let schedulesPerTeacher = getSchedulesPerTeacher(allCoursesMap);
            let valid_search_key = findClosestKey(schedulesPerTeacher, search_key);
            let scheduleForTeacher = schedulesPerTeacher.get(valid_search_key);

            //let scheduleForTeacher = schedulesPerTeacher.get(search_key);
            if (!scheduleForTeacher) return interaction.editReply("Pas d'emploi du temps trouvé pour le/la prof " + search_key);

            let embed = new Discord.EmbedBuilder()
                .setColor(getColor())
                .setTitle("Emploi du temps du prof " + valid_search_key)
                .setTimestamp()
                .setFooter({text: "Critère de recherche : " + search_key + "\nDate : " + date.toISOString().split('T')[0]});
            for (let [date, courses] of scheduleForTeacher) {
                let coursesString = "";
                for (let course of courses) {
                    coursesString +=
                        course.timeSlot.start.toLocaleString("fr-FR", {timeZone: 'Europe/Paris'}).split(' ')[1].substring(0, 5)
                        + " - "
                        + course.timeSlot.end.toLocaleString("fr-FR", {timeZone: 'Europe/Paris'}).split(' ')[1].substring(0, 5)
                        + " : "
                        + course.title
                        + " (en " + course.rooms.join(', ')
                        + " pour " + course.students.join(', ')
                        + ")\n";
                }
                embed.addFields({name: date, value: coursesString});
            }
            return interaction.editReply({embeds: [embed]});

        case 'salle':
            let schedulesPerRoom = getSchedulesPerRoom(allCoursesMap);
            let scheduleForRoom = schedulesPerRoom.get(search_key);
            if (!scheduleForRoom) return interaction.editReply("Pas d'emploi du temps trouvé pour la salle " + search_key);
            break;
        default:
            return interaction.editReply("Erreur dans la commande");
    }
}

async function fetchEDTBasic({interaction, channel, search_key, fullWeek, update, date}){
    if (!search_key) search_key = keysByRole['default'];

    const name = 'edt_' + search_key + '_' + (fullWeek ? 'semaine' : 'jour') + '_' + date.toISOString().split('T')[0] + '.png';
    const path = './images/edt/' + name;

    // check if file exists and is less than 1 hour old
    if (fs.existsSync(path) && !update) {
        const stats = fs.statSync(path);
        const now = new Date().getTime();
        const creationTime = new Date(stats.ctime).getTime();
        if (now - creationTime < 3600000) {
            const embed = new Discord.EmbedBuilder()
                .setColor(getColor())
                .setTitle("Emploi du temps " + (fullWeek ? "de la semaine" : "du jour") + " (" + date.toISOString().split('T')[0] + ")")
                .setTimestamp()
                .setImage('attachment://' + name)
                .setURL('https://www.emploisdutemps.uha.fr')
                .setFooter({text: "Critère de recherche : " + search_key + "\nDate : " + date.toISOString().split('T')[0]});
            if (interaction) return interaction.editReply({embeds: [embed], files: [path]});
            if (channel) return channel.send({embeds: [embed], files: [path]});
        }
    }

    if ((date.getDay() > 5 || date.getDay() == 0) && !fullWeek) {
        if (interaction) return interaction.editReply("C'est le week-end chacal");
        if (channel) return channel.send("EDT recherché pendant le week-end... Check edt.js");
    }

    // get the date of the first monday for the week of the date
    let monday = new Date(date);
    if (date.getDay() > 1) {
        monday.setDate(date.getDate() - date.getDay() + 1);
    }
    else if (date.getDay() == 0) {
        monday.setDate(date.getDate() - 6);
    }

    // launch browser and fetch the schedule
	const browser = await puppeteer.launch({
        headless: "new",
        args:[
            '--no-sandbox'
        ],
        defaultViewport: fullWeek ? {width: 1600, height: 1080} : {width: 900, height: 900}
    });

    const page = await browser.newPage();
    await page.goto('https://www.emploisdutemps.uha.fr');

    await page.waitForSelector('#username');
    await page.type('#username', email);
    await page.type('#password', password);
    await page.click('button.mdc-button--raised:nth-child(1)'); // login

    await page.waitForSelector('#x-auto-33-input');
    let search_input = await page.$('#x-auto-33-input');
    
    await search_input.type(search_key);
    await search_input.press('Enter'); // get classes for the group

    // if #x-auto-128 is found, it means that the group doesn't exist

    await page.waitForSelector('#x-auto-128');
    let labelNotFound = await page.$('#x-auto-128');
    await page.waitForNetworkIdle();

    let labelNotFoundText = await page.evaluate(element => element.textContent, labelNotFound);

    if (Number.parseInt(labelNotFoundText.split(' ')[0]) == 0){
        await browser.close();
        if (interaction) return interaction.editReply("Pas d'emploi du temps trouvé");
        if (channel) return channel.send("Pas d'emploi du temps trouvé");
    }

    await page.waitForSelector('#x-auto-129 > div.grilleDispo');

    await page.waitForSelector('#x-auto-129');
    let element = await page.$('#x-auto-129');

    // get all elements with id starting with x-auto- and text content matching "S<number> - lun.*"
    let mondaysButtons = await page.$$('div[id^="x-auto-"] button');

    // filter elements to keep only the ones matching "S<number> - lun.*"
    mondaysButtons = await Promise.all(mondaysButtons.map(async element => {
        let text = await page.evaluate(element => element.textContent, element);
        if (text.startsWith('S') && text.includes('lun.')) return element;
    }));

    let correctButton = null;

    for (let i=0; i<mondaysButtons.length; i++){
        if (mondaysButtons[i] == null) continue;
        const buttonDate = await getDateForButton(mondaysButtons[i], page);
        // check if day is monday (don't check for minutes, hours, etc.)
        if (buttonDate.toISOString().split('T')[0] == monday.toISOString().split('T')[0]) {
            correctButton = mondaysButtons[i];
            break;
        }
    }
    if (correctButton == null) {
        await browser.close();
        if (interaction) return interaction.editReply("Pas d'emploi du temps trouvé");
        if (channel) return channel.send("Pas d'emploi du temps trouvé");
    }

    await correctButton.click(); // get classes for the week

    await page.waitForSelector('#x-auto-129');
    await page.waitForNetworkIdle();

    let x_auto_id = 57 + date.getDay();

    await page.waitForSelector('#x-auto-129');
    await page.waitForNetworkIdle();

    if (!fullWeek) {
        // click on the day
        await page.waitForSelector('#x-auto-' + x_auto_id + '> tbody:nth-child(1) > tr:nth-child(2) > td:nth-child(2) > em:nth-child(1) > button:nth-child(1)');
        await page.click('#x-auto-' + x_auto_id + '> tbody:nth-child(1) > tr:nth-child(2) > td:nth-child(2) > em:nth-child(1) > button:nth-child(1)') // get classes for the day
    }

    await page.waitForNetworkIdle();
    await element.screenshot({path: path});
    await browser.close();

    if (interaction || channel)
    {
        const embed = new Discord.EmbedBuilder()
        .setColor(getColor())
        .setTitle("Emploi du temps " + (fullWeek ? "de la semaine" : "du jour") + " (" + date.toISOString().split('T')[0] + ")")
        .setTimestamp()
        .setImage('attachment://' + name)
        .setURL('https://www.emploisdutemps.uha.fr')
        .setFooter({text: "Critère de recherche : " + search_key + "\nDate : " + date.toISOString().split('T')[0]});

        if (interaction) interaction.editReply({embeds: [embed], files: [path]});
        else if (channel) channel.send({embeds: [embed], files: [path]});
    }

    const regex = new RegExp('edt_' + search_key + '_(semaine|jour)_' + date.toISOString().split('T')[0] + '\.png');
    if (!regex.test(name)) {
        fs.rm(path, (err) => {
            if (err) throw err;
        });
    };
}

async function fetchAllCourses({interaction, channel, search_key, fullWeek, update, date}){
    let map = new Map();

    let resolution = fullWeek ? {width: 1600, height: 1080} : {width: 900, height: 900};

    // launch browser and fetch the schedule
	const browser = await puppeteer.launch({
        headless: "new",
        args:[
            '--no-sandbox'
        ],
        defaultViewport: resolution
    });

    if ((date.getDay() > 5 || date.getDay() == 0) && !fullWeek) {
        if (interaction) return interaction.editReply("C'est le week-end chacal");
        if (channel) return channel.send("EDT recherché pendant le week-end... Check edt.js");
    }

    // get the date of the first monday for the week of the date
    let monday = new Date(date);
    if (date.getDay() > 1) {
        monday.setDate(date.getDate() - date.getDay() + 1);
    }
    else if (date.getDay() == 0) {
        monday.setDate(date.getDate() - 6);
    }

    const page = await browser.newPage();
    await page.goto('https://www.emploisdutemps.uha.fr');

    await page.waitForSelector('#username');
    await page.type('#username', email);
    await page.type('#password', password);
    await page.click('button.mdc-button--raised:nth-child(1)'); // login

    let roomsKeys = ["ILL_I", "ILL_M"];

    for (let room of roomsKeys) {
        await page.waitForSelector('#x-auto-33-input');
        let search_input = await page.$('#x-auto-33-input');
        
        await search_input.click({clickCount: 3});
        await search_input.press('Backspace'); 
        
        await search_input.type(room);
        await search_input.press('Enter');

        let labelNotFound = await page.$('#x-auto-128');
        await page.waitForNetworkIdle();

        let labelNotFoundText = await page.evaluate(element => element.textContent, labelNotFound);

        if (Number.parseInt(labelNotFoundText.split(' ')[0]) == 0){
            await browser.close();
            if (interaction) return interaction.editReply("Pas d'emploi du temps trouvé");
            if (channel) return channel.send("Pas d'emploi du temps trouvé");
        }

        await page.waitForSelector('#x-auto-129 > div.grilleDispo');

        // get all elements with id starting with x-auto- and text content matching "S<number> - lun.*"
        let mondaysButtons = await page.$$('div[id^="x-auto-"] button');

        // filter elements to keep only the ones matching "S<number> - lun.*"
        mondaysButtons = await Promise.all(mondaysButtons.map(async element => {
            let text = await page.evaluate(element => element.textContent, element);
            if (text.startsWith('S') && text.includes('lun.')) return element;
        }));

        let correctButton = null;

        for (let i=0; i<mondaysButtons.length; i++){
            if (mondaysButtons[i] == null) continue;
            const buttonDate = await getDateForButton(mondaysButtons[i], page);
            // check if day is monday (don't check for minutes, hours, etc.)
            if (buttonDate.toISOString().split('T')[0] == monday.toISOString().split('T')[0]) {
                correctButton = mondaysButtons[i];
                break;
            }
        }
        if (correctButton == null) {
            await browser.close();
            if (interaction) return interaction.editReply("Pas d'emploi du temps trouvé");
            if (channel) return channel.send("Pas d'emploi du temps trouvé");
        }

        await correctButton.click(); // get classes for the week

        await page.waitForSelector('#x-auto-129');
        await page.waitForNetworkIdle();

        let x_auto_id = 57 + date.getDay();

        await page.waitForSelector('#x-auto-129');
        await page.waitForNetworkIdle();

        if (!fullWeek) {
            // click on the day
            await page.waitForSelector('#x-auto-' + x_auto_id + '> tbody:nth-child(1) > tr:nth-child(2) > td:nth-child(2) > em:nth-child(1) > button:nth-child(1)');
            await page.click('#x-auto-' + x_auto_id + '> tbody:nth-child(1) > tr:nth-child(2) > td:nth-child(2) > em:nth-child(1) > button:nth-child(1)') // get classes for the day
        }

        // -----------

        await page.waitForNetworkIdle();

        // find .grilleDispo
        await page.waitForSelector('#x-auto-129 > div.grilleDispo');

        let divs = await page.$$('div');
        let children = [];

        for (let div of divs) {
            let id = await page.evaluate(element => element.id, div);
            if (id.startsWith('inner')) {
                let childrenTexts = (await page.evaluate(element => element.innerHTML, div));

                let text = childrenTexts.split('<b unselectable="on" class="eventText">')[1].replace('</b>', '<br>').split('<br>');
                let title = text[0].replace('T&amp;F', 'T&F');
                let lessonType = text[1].substring(1).replace('T&amp;F', 'T&F');
                let restOfText = text.slice(2);

                // normalize restOfText with NFC
                restOfText = restOfText
                    .map(item => item.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace('T&amp;F', 'T&F'))

                let rooms = [];
                let i = 0;
                while (restOfText[i].startsWith('ILL_')) {
                    if (restOfText[i].length > 0) rooms.push(restOfText[i]);
                    i++;
                }
                restOfText = restOfText.slice(i);
                
                let teacherRegex = new RegExp("^([A-Z']{2,}[ -]+([A-Za-z[' -]?)+)$"); //"^([A-Z' -]+[A-z' -]+)$");
                let students = [];
                i = 0;
                while (i < restOfText.length && !restOfText[i].match(teacherRegex)) {
                    if (restOfText[i].length > 0) students.push(restOfText[i]);
                    i++;
                }
                restOfText = restOfText.slice(i);

                let teachers = [];
                for (let teacher of restOfText) {
                    if (teacher.match(teacherRegex)) teachers.push(teacher);
                    else if (teacher.length > 0) console.log("Teacher " + teacher + " doesn't match the regex");
                }

                children.push({
                    title: title,
                    lessonType: lessonType,
                    rooms: rooms,
                    students: students,
                    teachers: teachers,
                    timeSlot: await getTimeslot(page, div, resolution, fullWeek ? monday : date, fullWeek)
                });

            }
        }

        let schedulesPerDay = new Map();
        for (let course of children) {
            if (!schedulesPerDay.has(course.timeSlot.start.toISOString().split('T')[0])) schedulesPerDay.set(course.timeSlot.start.toISOString().split('T')[0], []);
            schedulesPerDay.get(course.timeSlot.start.toISOString().split('T')[0]).push(course);
        }

        map.set(room, schedulesPerDay);
    }

    await browser.close();
    return map;
}

function getSchedulesPerTeacher(map){
    let schedulesPerTeacher = new Map();

    for (let [room, days] of map) {
        for (let [date, courses] of days) {
            for (let course of courses) {
                for (let teacher of course.teachers) {
                    if (!schedulesPerTeacher.has(teacher)) schedulesPerTeacher.set(teacher, new Map());
                    if (!schedulesPerTeacher.get(teacher).has(date)) schedulesPerTeacher.get(teacher).set(date, []);
                    schedulesPerTeacher.get(teacher).get(date).push(course);
                }
            }
        }
    }

    for (let [teacher, days] of schedulesPerTeacher) {
        for (let [date, courses] of days) {
            let sortedCourses = courses.sort((a, b) => a.timeSlot.start - b.timeSlot.start);
            days.set(date, sortedCourses);
        }
        let sortedDays = new Map([...days.entries()].sort());
        schedulesPerTeacher.set(teacher, sortedDays);
    }

    return schedulesPerTeacher;
}

function getSchedulesPerRoom(map){
    let schedulesPerRoom = new Map();

    for (let [room, days] of map) {
        for (let [date, courses] of days) {
            let schedulesPerDay = new Map();
            for (let course of courses) {
                if (!schedulesPerDay.has(course.timeSlot.start.toISOString().split('T')[0])) schedulesPerDay.set(course.timeSlot.start.toISOString().split('T')[0], []);
                schedulesPerDay.get(course.timeSlot.start.toISOString().split('T')[0]).push(course);
            }
            schedulesPerRoom.set(room, schedulesPerDay);
        }
    }

    return schedulesPerRoom;
}

async function getTimeslot(page, div, resolution, date, fullWeek){

    let heightDivider = resolution.height == 1080 ? 74 : 60;
    let widthDivider = resolution.width == 1600 ? 217 : 100;

    let parentHeight = Number(String(await page.evaluate(element => element.parentElement.style.height, div)).replace('px', ''));
    let grandParentTop = Number(String(await page.evaluate(element => element.parentElement.parentElement.style.top, div)).replace('px', ''));
    
    //console.log("Parent height:" + parentHeight);
    //console.log("Grandparent top:" + grandParentTop);

    let start = new Date(date);
    start.setHours(7);
    start.setMinutes(0);
    start.setSeconds(0);
    start.setMilliseconds(0);

    let minutes = Math.ceil(grandParentTop / heightDivider) * 60;
    // console.log("Minutes: " + minutes);
    start = new Date(start.getTime() + minutes * 60000);

    // if fullWeek, add the day of the date to start based on given resolution
    if (fullWeek) {
        let incrementBy = Math.floor(
            Number(
                String(
                    await page.evaluate(element => {
                        return element.parentElement.parentElement.style.left;
                    }, div)
                ).replace('px', '')
            ) / widthDivider
        );

        start = new Date(start.getTime() + incrementBy * 60000 * 60 * 24);
    }
    
    let duration = Math.ceil(parentHeight / heightDivider) * 60;
    let end = new Date(start.getTime() + duration * 60000);
    return {start: start, end: end};
}

function updateAllEDT(client){ // fetches all EDTs for all roles
    for (const [key, value] of Object.entries(keysByRole)) {
        fetchEDT({search_key: value, fullWeek: false, update: true});
        fetchEDT({search_key: value, fullWeek: true, update: true});
    }
}

function deleteEDTCache(){
    const folder = './images/edt';
    
    fs.readdir(folder, (err, files) => {
        if (err) throw err;
    
        for (const file of files) {
            fs.rm(folder + '/' + file, err => {
                if (err) throw err;
            });
        }
    })
    
}

function getMonthByName(name){
    switch(name){
        case 'janvier': return '01';
        case 'février': return '02';
        case 'mars': return '03';
        case 'avril': return '04';
        case 'mai': return '05';
        case 'juin': return '06';
        case 'juillet': return '07';
        case 'août': return '08';
        case 'septembre': return '09';
        case 'octobre': return '10';
        case 'novembre': return '11';
        case 'décembre': return '12';
        default: throw Error("Error while fetching EDT: " + name + " is not a month");
    }
}

async function getDateForButton(button, page){
    let text = await page.evaluate(element => element.textContent, button);
    text = text.split(' ');
    let day = text[3]
    let month = getMonthByName(text[4]);
    let year = text[5]
    return new Date(year + '-' + month + '-' + day);
}

function correctDateFormat(date){
    let dateArray = date.split('-');
    let year = dateArray[0];
    let month = dateArray[1];
    let day = dateArray[2];
    if (month.length == 1) month = '0' + month;
    if (day.length == 1) day = '0' + day;
    return year + '-' + month + '-' + day;
}

function isValidDate(year, month, day) {
    var d = new Date(year, month, day);
    if (d.getFullYear() != year) return false;
    if (d.getMonth() != month) return false;
    if (d.getDate() != day) return false;
    return true;
}

function findClosestKey(map, searchKey) {
    if (map.has(searchKey)) {
        return searchKey;
    } else {
        let keys = Array.from(map.keys());
        keys.sort((a, b) => {
            let aStartsWith = a.toLowerCase().startsWith(searchKey.toLowerCase());
            let bStartsWith = b.toLowerCase().startsWith(searchKey.toLowerCase());
            return (aStartsWith && !bStartsWith) ? -1 : (!aStartsWith && bStartsWith) ? 1 : 0;
        });
        return keys[0].toLowerCase().startsWith(searchKey.toLowerCase()) ? keys[0] : null;
    }
}