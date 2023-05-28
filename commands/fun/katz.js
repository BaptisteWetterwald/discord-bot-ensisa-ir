const Discord = require('discord.js');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

module.exports = {
	data: new Discord.SlashCommandBuilder()
		.setName('katz')
		.setDescription('Sends a random cat picture.')
		.setDMPermission(true),
	async execute(interaction) {
        fetch("https://api.thecatapi.com/v1/images/search")
			.then((response) => response.json())
			.then((data) => {
				interaction.reply(data[0].url);
			})
            .catch(err => {
				console.log(err);
                interaction.reply("Erreur lors de la requête.");
            });
	},
};