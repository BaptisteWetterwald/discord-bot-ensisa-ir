const Discord = require('discord.js');

module.exports = {
	data: new Discord.SlashCommandBuilder()
		.setName('rdm')
		.setDescription('Replies with a random int between optional min value and max value (inclusive).')
        .addIntegerOption(option => option.setName('max').setDescription('Maximum value.').setRequired(true))
        .addIntegerOption(option => option.setName('min').setDescription('Minimum value.')),
	async execute(interaction) {
        const min = interaction.options.getInteger('min') ?? 0;
        const max = interaction.options.getInteger('max');
        if (min > max) {
            return await interaction.reply('The minimum value must be lower than the maximum value.');
        }
        await interaction.reply(String(Math.floor(Math.random() * (max - min + 1) + min)));
    },
};