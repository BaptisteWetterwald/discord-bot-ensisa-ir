const Discord = require('discord.js');
const { getColor } = require('../../utils/randomColor.js');
const puppeteer = require('puppeteer');
const {email, password} = require('../../json/login_uha.json');
const {EDTChannel} = require('../../ids/channels-id.json');
const keysByRole = require('../../json/edt_keysByRole.json')

module.exports = {
	cooldown: 30,
    fetchEDTGeneral,
	data: new Discord.SlashCommandBuilder()
        .addStringOption(option => option.setName('critere').setDescription('Group to search for (ex: 2ir7)').setRequired(false))
        .addBooleanOption(option => option.setName('semaine').setDescription('Search for full week if true, else search for current day').setRequired(false))
		.setName('edt')
		.setDescription('Sends the classes schedule of the day.')
		.setDMPermission(true),
	async execute(interaction) {
		await interaction.deferReply();
        if (!fetchEDT(interaction, null)) {
            interaction.editReply("Pas d'emploi du temps trouvé");
        }
	},
};

async function fetchEDT(interaction = null, channel = null){
	const browser = await puppeteer.launch({headless: "new", args:['--no-sandbox']});
    const page = await browser.newPage();
    await page.goto('https://www.emploisdutemps.uha.fr');

    await page.waitForSelector('#username');
    await page.type('#username', email);
    await page.type('#password', password);
    await page.click('button.mdc-button--raised:nth-child(1)'); // login

    await page.waitForSelector('#x-auto-33-input');
    let search_input = await page.$('#x-auto-33-input');

    let search_key;

    if (interaction) {
        if (interaction.options.getString('critere')) search_key = interaction.options.getString('critere')
        else search_key = keysByRole['default'];
        await interaction.member.fetch();
        interaction.member.roles.cache.forEach(role => {
            if (keysByRole[role.id] && !search_key) {
                search_key = keysByRole[role.id];
            }
        });
    }
    else search_key = keysByRole['default'];
    
    await search_input.type(search_key);
    await search_input.press('Enter'); // get classes for the group

    await page.waitForSelector('#x-auto-129 > div.grilleDispo');

    if (interaction && !interaction.options.getBoolean('semaine')) {

        let day = new Date().getDay();
        if (day > 5){
            if (interaction) interaction.editReply("C'est le week-end chacal");
            else if (channel) channel.send("EDT recherché pendant le week-end... Check edt.js");
            else return null;
        }
        let x_auto_id = 57 + day;

        await page.click('#x-auto-' + x_auto_id + '> tbody:nth-child(1) > tr:nth-child(2) > td:nth-child(2) > em:nth-child(1) > button:nth-child(1)')
        await page.waitForSelector('#x-auto-129');
    }
    
    await page.waitForNetworkIdle();

    const element = await page.$('#x-auto-129');
    await element.screenshot({path: './edt.png'});

    if (interaction) {
        const embed = new Discord.EmbedBuilder()
            .setColor(getColor())
            .setTitle("Emploi du temps du jour")
            .setTimestamp()
            .setImage('attachment://edt.png')
            .setURL('https://www.emploisdutemps.uha.fr')
            .setFooter({text: "Critère de recherche : " + search_key});
        interaction.editReply({embeds: [embed], files: ['./edt.png']});
    }
    else if (channel) {
        const embed = new Discord.EmbedBuilder()
            .setColor(getColor())
            .setTitle("Emploi du temps du jour")
            .setTimestamp()
            .setImage('attachment://edt.png')
            .setURL('https://www.emploisdutemps.uha.fr')
            .setFooter({text: "Critère de recherche : " + search_key});
        channel.send({embeds: [embed], files: ['./edt.png']});
    }
    else {
        return null;
    }
}

function fetchEDTGeneral(client){
    fetchEDT(null, client.channels.cache.get(EDTChannel));
}