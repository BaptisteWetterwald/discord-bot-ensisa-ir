const Discord = require('discord.js');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

module.exports = {
	data: new Discord.SlashCommandBuilder()
		.setName('dawg')
		.setDescription('Sends a random dog picture.'),
	async execute(interaction) {
        fetch("https://dog.ceo/api/breeds/image/random")
			.then((res) => res.json())
			.then((json) => interaction.reply(json.message))
            .catch(err => {
				console.log(err);
                interaction.reply("Erreur lors de la requête.");
            });
	},
};