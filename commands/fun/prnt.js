const Discord = require('discord.js');
const DomParser = require('dom-parser');
const { getColor } = require('../../utils/randomColor.js');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

module.exports = {
	data: new Discord.SlashCommandBuilder()
		.setName('prnt')
		.setDescription('Replies with a random screenshot from prnt.sc')
        .setDMPermission(true),
	async execute(interaction) {
        sendRandomPic(interaction, 0);
    },
};

function makeid(length) {
    var result = [];
    var characters = 'abcdefghijklmnopqrstuvwxyz0123456789';
    var charactersLength = characters.length;
    for (var i = 0; i < length; i++) {
        result.push(characters.charAt(Math.floor(Math.random() *
            charactersLength)));
    }
    return result.join('');
}

function sendRandomPic(interaction, attempt) {
    if (attempt > 10) return interaction.reply("Erreur lors de la requête.");
    let id = makeid(6);
    if (!interaction.deferred) interaction.deferReply();
    
    fetch("https://prnt.sc/" + id)
        .then(function(response) {
            if (response.ok) return response.text();
        })
        .then(function(html) {
            const parser = new DomParser();
            const doc = parser.parseFromString(html, 'text/html');
            let src = doc.getElementById("screenshot-image").getAttribute("src");

            if (src === null || src.includes('//st.prntscr.com/')) return sendRandomPic(interaction, attempt + 1);

            fetch(src).then(function(response) {
                if (!response.ok) return sendRandomPic(interaction, attempt + 1);

                const embed = new Discord.EmbedBuilder()
                    .setColor(getColor())
                    .setTitle('Code généré: ' + id)
                    .setURL(src)
                    .setImage(src)
                    .setTimestamp();
                interaction.editReply({ embeds: [embed] });
            })
            .catch(console.error);
        })
        .catch(error => {
            interaction.editReply("Erreur lors de la requête.");
            console.log(error);
        });
}