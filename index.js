const fs = require('node:fs');
const path = require('node:path');

// Require the necessary discord.js classes
const { Client, Collection, GatewayIntentBits } = require('discord.js');
const { token } = require('./config.json');

const { CronJob } = require('cron');
const { setupDatabases } = require('./utils/setupDatabases');
const { fetchMenuGeneral } = require('./commands/ensisa/menu');
const { updateAllEDT, fetchEDT } = require('./commands/ensisa/edt')
const { setClockAvatar } = require('./utils/clockAvatar');
const { wishBirthdays } = require('./commands/ensisa/anniv');
const { EDTChannel } = require('./ids/channels-id.json');

// Create a new client instance
const client = new Client({ 
	intents: [
		GatewayIntentBits.MessageContent,
		GatewayIntentBits.Guilds, 
		GatewayIntentBits.GuildMembers,
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.GuildMessageReactions,
		GatewayIntentBits.GuildMessageTyping,
		GatewayIntentBits.DirectMessages,
		GatewayIntentBits.DirectMessageReactions,
		GatewayIntentBits.DirectMessageTyping,
		GatewayIntentBits.GuildEmojisAndStickers,
	] ,
	partials: ['MESSAGE', 'CHANNEL', 'REACTION'],
});

client.commands = new Collection();
client.cooldowns = new Collection();

const foldersPath = path.join(__dirname, 'commands');
const commandFolders = fs.readdirSync(foldersPath);

for (const folder of commandFolders) {
	const commandsPath = path.join(foldersPath, folder);
	const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
	for (const file of commandFiles) {
		const filePath = path.join(commandsPath, file);
		const command = require(filePath);
		// Set a new item in the Collection with the key as the command name and the value as the exported module
		if ('data' in command && 'execute' in command) {
			client.commands.set(command.data.name, command);
		} else {
			console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
		}
	}
}

const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

for (const file of eventFiles) {
	const filePath = path.join(eventsPath, file);
	const event = require(filePath);
	if (event.once) {
		client.once(event.name, (...args) => event.execute(...args));
	} else {
		client.on(event.name, (...args) => event.execute(...args));
	}
}

setupDatabases();

// cron job to fetch the menu every day from monday to friday at 10:00
new CronJob(
	'0 0 10 * * 1-5',
	function() {
		fetchMenuGeneral(client);
	},
	null,
	true,
	'Europe/Paris'
);

// cron job to update all EDT every day from monday to friday at 7:20
new CronJob(
	'20 7 * * 1-5',
	function() {
		updateAllEDT(client);
	},
	null,
	true,
	'Europe/Paris'
);

// cron job to send the EDT of the day every day from monday to friday at 7:30
new CronJob(
	'30 7 * * 1-5',
	function() {
		fetchEDT({channel: client.channels.cache.get(EDTChannel)})
	},
	null,
	true,
	'Europe/Paris'
);

// cron job to send the EDT of the week every monday at 7:30
new CronJob(
	'30 7 * * 1',
	function() {
		fetchEDT({channel: client.channels.cache.get(EDTChannel), fullWeek: true})
	},
	null,
	true,
	'Europe/Paris'
);

// cron job to update the clock avatar every 15 minutes (0, 15, 30, 45)
new CronJob(
	'0,15,30,45 * * * *',
	function() {
		setClockAvatar(client);
	},
	null,
	true,
	'Europe/Paris'
);

// update status every 30 minutes
new CronJob(
	'0,30 * * * *',
	function() {
		client.user.setPresence({
			activities: [{ name: "Ketchup + mayo = goulag" }],
			status: "online",
		});
	},
	null,
	true,
	'Europe/Paris'
);

new CronJob(
	'0 8 * * *',
	function() {
    	wishBirthdays(client);
	},
	null,
	true,
	'Europe/Paris'
);

// Log in to Discord with your client's token
client.login(token);

module.exports = { client };