const Discord = require('discord.js');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

module.exports = {
	data: new Discord.SlashCommandBuilder()
		.setName('facts')
		.setDescription('Sends a random Chuck Norris-like joke.'),
	async execute(interaction) {
        fetch('https://api.chucknorris.io/jokes/random')
            .then(function(response) {
                if (response.ok) return response.json();
            })
            .then(function(data) {
                let joke = data.value;
                joke = joke.replace("Chuck Norris", interaction.user.username);
                interaction.reply(joke);
            })
            .catch(err => {
                console.log(err);
                interaction.reply("Erreur lors de la requête.");
            });
	},
};