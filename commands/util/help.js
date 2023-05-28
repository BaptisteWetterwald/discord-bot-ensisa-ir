const Discord = require('discord.js');
const { getColor } = require('../../utils/randomColor.js');

module.exports = {
    data: new Discord.SlashCommandBuilder()
		.setName('help')
		.setDescription('Sends a list of commands with their description.')
        .setDMPermission(true),
	async execute(interaction) {
        let decs = {};
        interaction.client.commands.forEach(command => {
            decs[command.data.name] = command.data.description;
        });
        let embed = new Discord.EmbedBuilder()
		.setColor(getColor())
		.setTitle('Commandes disponibles')
		.setTimestamp();

        let fields = [];
        Object.keys(decs).sort().forEach((command) => {
            fields.push({name: command, value: decs[command], inline: false});
        });
        embed.addFields(fields);
        interaction.reply({ embeds: [embed] });
	},
};