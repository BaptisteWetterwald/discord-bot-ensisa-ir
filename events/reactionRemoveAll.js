const { Events } = require('discord.js');
const { logDeleteAllReactions } = require('../utils/logReactions');

module.exports = {
    name: Events.MessageReactionRemoveAll,
    once: true,
    execute(message, reactions) {
        //logDeleteAllReactions(message, reactions);
    }
};