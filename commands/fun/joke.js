const Discord = require('discord.js');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const JokeAPI = require('sv443-joke-api');

module.exports = {
	data: new Discord.SlashCommandBuilder()
		.setName('joke')
		.setDescription('Sends a joke.')
        .setDMPermission(true),
	async execute(interaction) {
        JokeAPI.getJokes({categories: ['dark']})
        .then((res) => res.json())
        .then((data) => {
            interaction.reply(data.setup + "\n" + data.delivery);
        });
    },
};