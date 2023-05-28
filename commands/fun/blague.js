const Discord = require('discord.js');
const BlaguesAPI = require('blagues-api');
const { blagues_api_key } = require('../../api_keys.json');
const blagues = new BlaguesAPI(blagues_api_key);

module.exports = {
	data: new Discord.SlashCommandBuilder()
		.setName('blague')
		.setDescription('Sends a joke (in french).')
		.setDMPermission(true),
	async execute(interaction) {
        const data = await blagues.random();
		let joke = data.joke;
		joke += "\n" + data.answer;
		interaction.reply(joke);
	},
};