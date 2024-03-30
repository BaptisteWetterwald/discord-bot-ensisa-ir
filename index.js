const fs = require('node:fs');
const path = require('node:path');

// Require the necessary discord.js classes
const { Client, Collection, GatewayIntentBits } = require('discord.js');
const { token } = require('./config.json');

const { CronJob } = require('cron');
const { setupDatabases } = require('./utils/setupDatabases');
const { fetchMenuGeneral } = require('./commands/ensisa/menu');
const { fetchEDT } = require('./commands/ensisa/edt')
const { setClockAvatar } = require('./utils/clockAvatar');
const { wishBirthdays } = require('./commands/ensisa/anniv');
const { EDTChannel } = require('./ids/channels-id.json');
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./database/bot-discord-db.sqlite');
const puppeteer = require('puppeteer');
const {email, password} = require('./json/login_uha.json');
const { marksChannel } = require('./ids/channels-id.json');
const { getColor } = require('./utils/randomColor');
const Discord = require('discord.js');


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

// cron job to send the EDT of the next week every sunday at 8pm
new CronJob(
	'0 20 * * 0',
	function() {
		fetchEDT({channel: client.channels.cache.get(EDTChannel), fullWeek: true, increment: 1})
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

// cronjob to check for new marks every hour
new CronJob(
	'0 */1 * * *',
	function() {
		fetchMarks();
	},
	null,
	true,
	'Europe/Paris'
);

async function fetchMarks(){
	db.run('CREATE TABLE IF NOT EXISTS marks (url TEXT PRIMARY KEY, name TEXT NOT NULL)', 
		(err) => {
			if (err) console.log(`[ERROR] ${err.message}`);
		}
	);

	const browser = await puppeteer.launch({headless: 'new', args:['--no-sandbox']});
    const page = await browser.newPage();
    await page.goto('https://e-formation.uha.fr/login/index.php?authCAS=CAS');
	await page.waitForSelector('#username');
    await page.type('#username', email);
    await page.type('#password', password);
    await page.click('button.mdc-button--raised:nth-child(1)'); // login
	await page.waitForNetworkIdle();

	await page.goto('https://e-formation.uha.fr/course/view.php?id=8903&section=4'); // moodle page with the marks files

	await page.waitForSelector("#ygtv1");
	const container = await page.$("#ygtv1");
	const files = await container.$$("div.ygtvitem");

	for (const file of files) {
		const link = await file.$("a");

		let url = await (await link.getProperty('href')).jsonValue();
		url = String(url).replace('?forcedownload=1', '');
		const name = await (await link.getProperty('text')).jsonValue();
		
		// check if the file is already in the database and add it if not
		db.get('SELECT * FROM marks WHERE url = ?', [url], (err, row) => async function() {
			if (err) return console.log(`[ERROR] ${err.message}`);
			if (!row) {

				db.run('INSERT INTO marks(url, name) VALUES(?, ?)', [url, name], (err) =>  {
					if (err) return console.log(`[ERROR] ${err.message}`);
				});

				// create embed with the link to the file and the name of the file
				let embed = new Discord.EmbedBuilder()
					.setColor(getColor())
					.setTitle('Nouvelle note disponible !')
					.setDescription(`[${name}](${url})`)
					.setTimestamp()
					.setFooter(Discord.EmbedFooterAction = {
						text: 'Puisse le sort vous être favorable...'
					})
					.setURL(url);

				client.channels.cache.get(marksChannel).send({ embeds: [embed] });
			}
		}.call());
	}
	await browser.close();

}

// Log in to Discord with your client's token
client.login(token);

module.exports = { client };