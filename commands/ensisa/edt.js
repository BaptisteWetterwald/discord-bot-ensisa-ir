const Discord = require('discord.js');
const puppeteer = require('puppeteer');
const fs = require('fs');

const { getColor } = require('../../utils/randomColor.js');
const {email, password} = require('../../json/login_uha.json');
const {EDTChannel} = require('../../ids/channels-id.json');
const keysByRole = require('../../json/edt_keysByRole.json')

module.exports = {
    fetchEDTGeneral,
    deleteEDTCache,
	data: new Discord.SlashCommandBuilder()
        .addStringOption(option => option.setName('critere').setDescription('Group to search for (ex: 2ir7)').setRequired(false))
        .addBooleanOption(option => option.setName('semaine').setDescription('Search for full week if true, else search for current day').setRequired(false))
        .addBooleanOption(option => option.setName('update').setDescription('Force update of the schedule').setRequired(false))
		.setName('edt')
		.setDescription('Sends the classes schedule of the day/week.')
		.setDMPermission(true),
	async execute(interaction) {
		await interaction.deferReply();
        if (!fetchEDT(interaction, null)) {
            interaction.editReply("Pas d'emploi du temps trouvé");
        }
	},
};

async function fetchEDT(interaction = null, channel = null, fullWeek = false, update = false){

    let search_key;

    if (interaction) {
        if (interaction.options.getBoolean('semaine')) fullWeek = interaction.options.getBoolean('semaine');
        if (interaction.options.getBoolean('update')) update = interaction.options.getBoolean('update');
        if (interaction.options.getString('critere')) search_key = interaction.options.getString('critere');
        await interaction.member.fetch();
        interaction.member.roles.cache.forEach(role => {
            if (keysByRole[role.id] && !search_key) {
                search_key = keysByRole[role.id];
            }
        });
    }

    if (!search_key) search_key = keysByRole['default'];

    const name = 'edt_' + search_key + '_' + (fullWeek ? 'semaine' : 'jour') + '.png';
    const path = './images/edt/' + name;

    // check if file exists and is older than 1 hour
    if (fs.existsSync(path) && !update) {
        const stats = fs.statSync(path);
        const now = new Date().getTime();
        const creationTime = new Date(stats.ctime).getTime();
        if (now - creationTime < 3600000) {
            const embed = new Discord.EmbedBuilder()
                .setColor(getColor())
                .setTitle("Emploi du temps " + (fullWeek ? "de la semaine" : "du jour"))
                .setTimestamp()
                .setImage('attachment://' + name)
                .setURL('https://www.emploisdutemps.uha.fr')
                .setFooter({text: "Critère de recherche : " + search_key});

            if (interaction) return interaction.editReply({embeds: [embed], files: [path]});
            if (channel) return channel.send({embeds: [embed], files: [path]});
            throw new Error("No interaction or channel provided to fetchEDT");
        }
    }

	const browser = await puppeteer.launch({headless: "new", args:['--no-sandbox']});
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

    await page.waitForSelector('#x-auto-129 > div.grilleDispo');

    let day = new Date().getDay();
    if (day > 5){
        if (interaction) return interaction.editReply("C'est le week-end chacal");
        if (channel) return channel.send("EDT recherché pendant le week-end... Check edt.js");
    }

    let x_auto_id = 57 + day;

    await page.waitForSelector('#x-auto-129');

    if (!fullWeek) {
        await page.click('#x-auto-' + x_auto_id + '> tbody:nth-child(1) > tr:nth-child(2) > td:nth-child(2) > em:nth-child(1) > button:nth-child(1)') // get classes for the day
        await page.waitForSelector('#x-auto-129');
    }

    await page.waitForNetworkIdle();
    const element = await page.$('#x-auto-129');

    await element.screenshot({path: path});
    await browser.close();

    const embed = new Discord.EmbedBuilder()
        .setColor(getColor())
        .setTitle("Emploi du temps " + (fullWeek ? "de la semaine" : "du jour"))
        .setTimestamp()
        .setImage('attachment://' + name)
        .setURL('https://www.emploisdutemps.uha.fr')
        .setFooter({text: "Critère de recherche : " + search_key});

    if (interaction) interaction.editReply({embeds: [embed], files: [path]});
    else if (channel) channel.send({embeds: [embed], files: [path]});
    else throw new Error("No interaction or channel provided to fetchEDT");

    // delete from cache if name doesn't match "edt_<2ir[0-7]>_<semaine|jour>.png"
    const regex = /edt_2ir[0-7]_(semaine|jour)\.png/;
    if (!regex.test(name)) {
        // delete file from cache
        deleteEDTCache();
    };
}

function fetchEDTGeneral(client){
    deleteEDTCache();
    fetchEDT(null, client.channels.cache.get(EDTChannel), fullWeek = true, update = true);
}

function deleteEDTCache(){
    const directory = '../../images/edt';
    const path = require('path');
    // delete all files in cache
    fs.readdir(directory, (err, files) => {
        if (err) throw err;
      
        for (const file of files) {
          fs.rm(path.join(directory, file));
        }
    });

}