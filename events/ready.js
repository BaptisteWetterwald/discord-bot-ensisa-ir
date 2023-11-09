const { Events } = require('discord.js');
const { deleteEDTCache, updateAllEDT} = require('../commands/ensisa/edt');

module.exports = {
	name: Events.ClientReady,
	once: true,
	async execute(client) {

		// for all guilds, fetch all channels and all users to update cache
		await client.guilds.cache.forEach(guild => {
			guild.channels.fetch();
			guild.members.fetch();
		});

		console.log(`Ready! Logged in as ${client.user.tag}`);
		
		client.user.setPresence({
			activities: [{ name: "Ketchup + mayo = goulag" }],
			status: "online",
		});
		
		// make deleteCache async then call it here

		//updateAllEDT(client);
	},
};
