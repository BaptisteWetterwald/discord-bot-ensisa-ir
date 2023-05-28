const Discord = require('discord.js');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

module.exports = {
	data: new Discord.SlashCommandBuilder()
		.setName('joke')
		.setDescription('Sends a joke (in english).'),
	async execute(interaction) {
        fetch('https://official-joke-api.appspot.com/random_joke')
        .then(function(response) {
            if (response.ok) return response.json();
        })
        .then(function(data) {
            let joke = data.setup;
            joke += "\n" + data.punchline;
            interaction.reply(joke);
        })
        .catch(err => {
            console.log(err);
            interaction.reply("Erreur lors de la requête.");
        });
	},
};