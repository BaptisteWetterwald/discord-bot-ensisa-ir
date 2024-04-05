const Discord = require('discord.js');
const OpenAI = require('openai');
const sqlite3 = require('sqlite3').verbose();
let db = new sqlite3.Database('./database/bot-discord-db.sqlite');

const { chatgpt_key } = require('../../api_keys.json');
const { clientId } = require('../../config.json');
const openai = new OpenAI({
    apiKey: chatgpt_key,
});

const { systemPrompt } = require('../../json/chadgpt.json');

module.exports = {
    onReplyToBot,
    setupPromptsDatabase,
	data: new Discord.SlashCommandBuilder()
		.setName('chadgpt')
		.setDescription('Replies as a Chad using ChatGPT 3.5')
		.setDMPermission(false)
        .addStringOption(option =>
            option.setName('prompt')
                .setDescription('The prompt to use for the AI')
                .setRequired(true)),
	async execute(interaction) {
        await interaction.deferReply();

        const prompt = interaction.options.getString('prompt');
        const response = await generateResponse(interaction.channel, prompt);
        await interaction.editReply(response);

        // store the prompt in the database for future use
        db.run('INSERT INTO chadgpt_prompts (interaction_id, prompt) VALUES (?, ?)', [interaction.id, prompt], (err) => {
            if (err) console.log(`[ERROR] ${err.message}`);
        });
	},
};

async function generateResponse(channel, prompt, messageId) {  
    
    let messages = await getHistory(channel, messageId, prompt);
    
    const chatCompletion = await openai.chat.completions.create({
        messages: messages,
        model: "gpt-3.5-turbo-0125",
    }).catch(err => {
        console.error(err);
        return "An error occurred while generating the response.";
    });

    /*console.log("Messages:\n" + messages.map(m => {
        return `${m.role}: ${m.content}`;
    }).join("\n") + "\n\n");*/

    return chatCompletion.choices[0].message.content;
}

async function getHistory(channel, messageId, prompt) {
    let message = await channel.messages.fetch(messageId);
    let reference = message.reference;

    let basics = [
        {role: "system", content: systemPrompt},
    ];

    if (!reference) {
        // first message, just add the prompt 

        if (prompt) {
            return basics.concat({role: "user", content: prompt});
        }

        // get the prompt from the database
        let dbPrompt = await new Promise((resolve, reject) => {
            db.get('SELECT prompt FROM chadgpt_prompts WHERE interaction_id = ?', [message.interaction.id], (err, row) => {
                if (err) {
                    console.log(`[ERROR] ${err.message}`);
                    reject(err);
                }
                resolve(row.prompt);
            });
        });

        return basics.concat([{role: "user", content: dbPrompt}, {role: "assistant", content: message.content}]);
    }

    let refMessage = await channel.messages.fetch(reference.messageId);
    return (await getHistory(channel, refMessage.id)).concat({role: message.author.id === clientId ? "assistant" : "user", content: message.content});
}

async function onReplyToBot(message) {
    if (message.author.bot) return;
    let ref = message.reference;
    if (!ref) return;
    let refMessage = await message.fetchReference();
    if (refMessage.author.id !== clientId) return;

    message.reply(await generateResponse(message.channel, message.content, message.id));
}

function setupPromptsDatabase() {
    db.run('CREATE TABLE IF NOT EXISTS chadgpt_prompts (interaction_id TEXT PRIMARY KEY, prompt TEXT NOT NULL)', 
        (err) => {
            if (err) console.log(`[ERROR] ${err.message}`);
        }
    );
}