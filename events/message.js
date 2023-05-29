const Discord  = require('discord.js');
const { checkForAbsences } = require('../commands/ensisa/absences');
const reactionsByEnd = require('../json/reactionsByEnd.json');
const reactionsByRole  = require('../json/reactionsByRole.json');
const autoReplies  = require('../json/autoReplies.json');
const { laughingWords }  = require('../json/laughingWords.json');
const { leagueOfLegends } = require('../ids/channels-id.json');

let client;

module.exports = {
	name: Discord.Events.MessageCreate,
	execute(message) {
        client = message.client;
        if (message.author.bot) return;
        if (message.content.endsWith("++") || message.content.endsWith("--")) return checkForAbsences(message);

        emojiIfEndsWith(message);
        emojiIfLaughing(message);
        emojiIfLeagueOfLegends(message);
        emojiIfRole(message);
        autoReply(message);
    },
};

function emojiIfEndsWith(message) {
    Object.keys(reactionsByEnd).forEach((word) => {
        if (message.content.toLowerCase().endsWith(word)) return message.react(client.emojis.cache.find(emoji => emoji.name === reactionsByEnd[word]));
    });
}

function emojiIfLaughing(message) {
    laughingWords.forEach((word) => {
        if (message.content.toLowerCase().includes(word)) return message.react("😹");
    });
}

function emojiIfLeagueOfLegends(message) {
    if (
        message.content.includes("LoL") ||
        message.content.toLowerCase().includes("league of legends") ||
        message.channel.id == leagueOfLegends
    )
        message.react("🚿");
}

function emojiIfRole(message) {
    Object.keys(reactionsByRole).forEach((roleId) => {
        if (message.member.roles.cache.has(roleId)) message.react(client.emojis.cache.find(emoji => emoji.name === reactionsByRole[roleId]));
    });
}

function autoReply(message) {
    Object.keys(autoReplies).forEach((word) => {
        if (message.content.toLowerCase().includes(word))
            message.reply(autoReplies[word].replace('{sender}', message.author.username));
    });
}