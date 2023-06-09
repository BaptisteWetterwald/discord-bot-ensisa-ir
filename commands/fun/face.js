const Discord = require('discord.js');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

module.exports = {
    data: new Discord.SlashCommandBuilder()
		.setName('face')
		.setDescription('Sends a random face picture from thispersondoesnotexist.com.')
        .setDMPermission(true),
	async execute(interaction) {
        let url = "https://fakeface.rest/face/json";
        interaction.deferReply();
        await fetch(url)
            .then(function(response) {
                if (response.ok) return response.json();
            })
            .then(function(data) {
                // if no problem
                if (data.status = "success") {
                    interaction.editReply({ files: [data.image_url] });
                }
            })
            .catch(err => {
                console.log(err);
                interaction.editReply("Erreur lors de la requête.");
            });
	},
};