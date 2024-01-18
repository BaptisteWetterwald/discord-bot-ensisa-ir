const Discord = require('discord.js');
const puppeteer = require('puppeteer');
const fs = require('fs');

const { getColor } = require('../../utils/randomColor.js');
const {email, password} = require('../../json/login_uha.json');
const keysByRole = require('../../json/edt_keysByRole.json')

module.exports = {
    updateAllEDT,
    deleteEDTCache,
    fetchEDT,
	data: new Discord.SlashCommandBuilder()
        .addStringOption(option => option.setName('critere').setDescription('Group to search for (ex: 2ir7)').setRequired(false))
        .addStringOption(option => option.setName('date').setDescription('Date to search for (ex: 2021-10-01)').setRequired(false))
        .addStringOption(option => option.setName('increment').setDescription('Increment the date by the specified number of days (ex: 1, -1)').setRequired(false))
        .addBooleanOption(option => option.setName('semaine').setDescription('Search for full week if true, else search for current day').setRequired(false))
        .addBooleanOption(option => option.setName('update').setDescription('Force update of the schedule').setRequired(false))
		.setName('edt')
		.setDescription('Sends the classes schedule of the specified day/week.')
		.setDMPermission(true),
	async execute(interaction) {
		await interaction.deferReply();
        fetchEDT({interaction: interaction});
	},
};

async function fetchEDT({interaction, channel, search_key, fullWeek = false, update = false}){
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
        else if (interaction.options.getString('increment')) {
            let increment = interaction.options.getString('increment');
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
	const browser = await puppeteer.launch({headless: /*false*/"new", args:['--no-sandbox']});

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

    // set element width to 1206px then screenshot it
    /*await page.evaluate(element => {
        let elements = [];
        elements.push(document.querySelector('#\\31 3')); // saturday table header
        elements.push(document.querySelector('#\\31 4')); // saturday table label
        elements.push(document.querySelector('#\\32 0')); // saturday grid column
        elements.push(document.querySelector('#x-auto-63')); // saturday grid column
        elements.push(document.querySelector('.grilleDispo > div:nth-child(6)'));
        elements.forEach(element => element.remove());
        element.style.width = '100%';
    }, element);*/

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