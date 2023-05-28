const Discord = require('discord.js');
const cheerio = require('cheerio');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const { cantineChannelId } = require('../../config.json');
const { getColor } = require('../../utils/randomColor.js');

module.exports = {
	cooldown: 3,
    fetchMenu,
    getMenuEmbed,
	data: new Discord.SlashCommandBuilder()
		.setName('menu')
		.setDescription('Sends the menu of the day (RU Illberg).')
		.setDMPermission(true),
	async execute(interaction) {
        if (fetchMenu(interaction) == null) {
            interaction.reply("Pas de menu aujourd'hui (boloss).");
        }
	},
};

async function fetchMenu(interaction){
	fetch('https://www.crous-strasbourg.fr/restaurant/resto-u-de-lillberg/')
		.then(res => res.text())
		.then(html => {
			let $ = cheerio.load(html);
			let menus = {};
			let menusDiv = $('.menu');

			let today = new Date().toLocaleDateString('fr-FR', {
				timeZone: 'Europe/Paris',
				day: '2-digit',
				month: 'long',
				year: 'numeric'
			});
			
			for (let i = 0; i < menusDiv.length; i++) {
				let date = $(menusDiv[i]).find('.menu_date_title').text();
				date = date.split(' ').slice(-3).join(' ');
				// if first word is an int < 10, add a 0 before
				if (date.split(' ')[0].length == 1) {
					date = '0' + date;
				}
				if (date == today) {
					$(menusDiv[i]).find('.meal_foodies').first().children('li').each(function(i, elem) {
						let title = $(this).text().replace($(this).find('ul').text(), '');
						let items = [];
						$(this).find('ul').find('li').each(function(i, elem) {
							items.push($(this).text());
						});
						menus[title] = items;
					});
					break;
				}
			}

			if (Object.keys(menus).length == 0 || (Object.keys(menus).length == 1 && Object.keys(menus).includes('Origines de nos viandes du jour'))) {
				return null; // no menu found for today
			}

			let meatOrigin = menus['Origines de nos viandes du jour'];
			delete menus['Origines de nos viandes du jour'];

			/*console.log("Menus du jour :");
			console.log(menus);
			console.log("Origine de la viande :");
			console.log(meatOrigin);*/

			let embed = getMenuEmbed(menus, meatOrigin);
			interaction.reply({ embeds: [embed] });
		})
		.catch(err => {
			console.log(err);
			interaction.reply("Erreur lors de la requête.");
		});
	return true;
}

function getMenuEmbed(menus, meatOrigin){
	// create an embed with the menus and the meat origin at the end
	let embed = new Discord.EmbedBuilder()
		.setColor(getColor())
		.setTitle('Menus du jour')
		.setTimestamp()
		.setFooter(Discord.EmbedFooterAction = {
			text: 'Bon appétit !',
		})
		.setURL('https://www.crous-strasbourg.fr/restaurant/resto-u-de-lillberg/');

	let fields = [];
	Object.keys(menus).forEach((menu) => {
		let menuString = "";
		menus[menu].forEach((item) => {
			menuString += item + "\n";
		});
		fields.push({name: menu, value: menuString, inline: false});
	});

	let meatOriginString = "";
	meatOrigin.forEach((item) => {
		meatOriginString += item + "\n";
	});
	fields.push({name: "Origine de la viande", value: meatOriginString, inline: false});
	
	embed.addFields(fields);
	return embed;
}

function fetchMenuGeneral(){
	fetchMenu(client.channels.cache.get(cantineChannelId));
}