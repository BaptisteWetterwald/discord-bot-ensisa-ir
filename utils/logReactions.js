const { logReactions } = require('../ids/channels-id.json');
const client = require('../index');

module.exports = {
    logDeleteReaction,
    logDeleteAllReactions
};

function logDeleteReaction(reaction, user) {
    if (reaction.client.user === user) return;
	client.channels.fetch(logReactions).then((channel) => {
		channel.send(
			"Reaction removed" +
				"\n" +
				"Reaction: " +
				reaction.emoji.toString() +
				"\n" +
				"Removed by: " +
				user.username +
				"#" +
				user.discriminator +
				" (" +
				user.id +
				")" +
				"\n" +
				"Channel: " +
				reaction.message.channel.name +
				" (" +
				reaction.message.channel.id +
				")" +
				"\n" +
				"Message: " +
				reaction.message.id
		);
	}).catch(console.error);
}

function logDeleteAllReactions(message, reactions) {
    message.client.channels.fetch(logReactions).then((channel) => {
        channel.send(
            "All reactions removed" +
                "\n" +
                "Reactions: " +
                Array.from(reactions).map((r) => r[1].emoji) +
                "\n" +
                "Channel: " +
                message.channelId +
                "\n" +
                "Message: " +
                message.id
        );
    }).catch(console.error);
}