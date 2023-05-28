const { Events } = require('discord.js');
const { logDeleteReaction } = require('../utils/logReactions');

module.exports = {
    name: Events.MessageReactionRemove,
    once: true,
    execute(reaction, user) {
        if (user.bot) return;
        //logDeleteReaction(reaction, user);
    },
};