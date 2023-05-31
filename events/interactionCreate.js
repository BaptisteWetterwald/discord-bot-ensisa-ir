const { Events } = require('discord.js');
const { executeCommand } = require('../executors/commands.js');
const { executeButton } = require('../executors/buttons.js');
const { mainChannel } = require('../ids/channels-id.json');
const { names } = require('../json/commands-bypass-channel.json');

module.exports = {
	name: Events.InteractionCreate,
	async execute(interaction) {
        if (interaction.isChatInputCommand() && interaction.channel != null && interaction.channel.id != mainChannel){
            if (!shouldBypass(interaction.commandName)) return await interaction.reply({ content: `Le bot est désactivé dans ce salon, va dans <#${mainChannel}>`, ephemeral: true });
        }
        if (interaction.isChatInputCommand()) return executeCommand(interaction);
        if (interaction.isButton()) return executeButton(interaction);
    },
};

function shouldBypass(command){
    let bypass = false;
    names.forEach(name => {
        if (command == name) bypass = true;
    });
    return bypass;
}