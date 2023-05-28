const Discord = require('discord.js');
const sqlite3 = require('sqlite3').verbose();
let db = null;
const deleteButtonId = 'deleteQuote';

const deleteButton = new Discord.ButtonBuilder()
    .setCustomId(deleteButtonId)
    .setLabel('Supprimer')
    .setEmoji('🗑️')
    .setStyle(Discord.ButtonStyle.Danger);

module.exports = {
	data: new Discord.SlashCommandBuilder()
		.setName('citation')
		.setDescription('Store or display a quote based on the given arguments.')
        .addStringOption(option => option.setName('identifier').setDescription('Identifier of the quote to store.').setRequired(false))
        .addIntegerOption(option => option.setName('index').setDescription('Index of the quote to display for a specific identifier.').setRequired(false))
        .addAttachmentOption(option => option.setName('attachment0').setDescription('Attachment to store.').setRequired(false))
        .addAttachmentOption(option => option.setName('attachment1').setDescription('Attachment to store.').setRequired(false))
        .addAttachmentOption(option => option.setName('attachment2').setDescription('Attachment to store.').setRequired(false))
        .addAttachmentOption(option => option.setName('attachment3').setDescription('Attachment to store.').setRequired(false))
        .addAttachmentOption(option => option.setName('attachment4').setDescription('Attachment to store.').setRequired(false))
        .addAttachmentOption(option => option.setName('attachment5').setDescription('Attachment to store.').setRequired(false))
        .addAttachmentOption(option => option.setName('attachment6').setDescription('Attachment to store.').setRequired(false))
        .addAttachmentOption(option => option.setName('attachment7').setDescription('Attachment to store.').setRequired(false))
        .addAttachmentOption(option => option.setName('attachment8').setDescription('Attachment to store.').setRequired(false))
        .addAttachmentOption(option => option.setName('attachment9').setDescription('Attachment to store.').setRequired(false))
        .setDMPermission(false),
	async execute(interaction) {
        if (db == null){
            db = new sqlite3.Database('./database/bot-discord-db.sqlite');
            setupCitationsDatabase();
        }

        let attachments = [];
        for (let i = 0; i < 10; i++){
            let attachment = interaction.options.getAttachment('attachment' + i);
            if (attachment) {              
                attachments.push(attachment);
            }
        }

        await interaction.deferReply();

        if (attachments.length > 0){

            let totalSize = 0;
            for (let attachment of attachments){
                if (!attachment.url.endsWith('.png') && !attachment.url.endsWith('.jpg') && !attachment.url.endsWith('.jpeg')){
                    return interaction.editReply('Les fichiers joints doivent être des images.');
                }
                totalSize += attachment.size;
            }
            if (totalSize > 8000000) return interaction.editReply('La taille totale des fichiers joints ne doit pas dépasser 8MB.');

            let identifier = interaction.options.getString('identifier');
            if (identifier){
                if (identifier.split(' ').length > 1) return interaction.editReply('L\'identifiant doit être un mot seul.');

                let ephemeralUrls = [];
                let images = [];
                for (let attachment of attachments){
                    ephemeralUrls.push(attachment.url);
                }
                await interaction.editReply({content: 'Enregistrement des citations suivantes...', files: ephemeralUrls}).catch(console.error);
                const message = await interaction.fetchReply().catch(console.error);
                let messageAttachments = message.attachments;

                messageAttachments.forEach(attachment => {
                    images.push(attachment.url);
                });

                return storeImages(identifier, images, interaction);
            }
            else return interaction.editReply('Vous devez spécifier un identifiant pour enregistrer une image.');
        }

        let identifier = interaction.options.getString('identifier');
        if (identifier) {
            let index = interaction.options.getInteger('index');
            if (index){
                return sendImage(interaction, identifier, index);
            }
            return sendImage(interaction, identifier, null);
        } else {
            return sendRandomImage(interaction);
        }
    },
};

function storeImages(identifier, urls, interaction){
    let params = [];
    let id = String(identifier).toLowerCase();
    for (let url of urls){
        params.push(id);
        params.push(String(url));
    }
    let sql = ('INSERT INTO citations(author, image) VALUES ' + ('(?, ?), '.repeat(urls.length))).slice(0, -2);
    db.run(sql, params, (error)=>{
        if (error){
            console.log(error);
            interaction.editReply("Erreur lors de l'enregistrement d'une image dans la DB.");
        };
    }, function(){
        interaction.editReply("Ajouté " + this.changes + " citation(s) à la DB.");
    });
};

async function sendImage(interaction, identifier, index){
    db.all("SELECT image FROM citations WHERE author=?", [String(identifier).toLowerCase()], (error, rows) => {
        if (error) throw error;
        if (rows){
            let urls = [];
            rows.forEach((row)=>{
                let url = row.image;
                urls.push(url);
            });
            if (urls.length > 0){
                let chosenIndex;
                if (index != null){
                    let indexAsNum = Number(index);
                    if (Number.isInteger(indexAsNum) && indexAsNum >= 1 && indexAsNum <= urls.length) chosenIndex = indexAsNum;
                    else return interaction.editReply('L\'index doit être compris entre 1 et ' + urls.length);
                }
                else chosenIndex = Math.floor(Math.random()*urls.length) + 1;
                interaction.editReply({
                    content: "Cet identifiant a " + urls.length + " citation(s) associée(s). Index actuel : " + chosenIndex,
                    files: [{
                        attachment: urls[chosenIndex - 1]
                    }],
                    components:[
                        new Discord.ActionRowBuilder().addComponents(deleteButton)
                    ]
                }).then(() => {
                    requestDeletion(interaction, identifier, urls[chosenIndex - 1]);
                });
            }
            else return interaction.editReply("Il n'y a pas de citation associée à cet identifiant");
        }
        else return interaction.editReply("Il n'y a pas de citation associée à cet identifiant");
    });
}

async function sendRandomImage(interaction){
    db.all("SELECT author, image FROM citations", [], (error, rows) => {
        if (error) throw error;
        if (rows){
            let urls = [];
            let ids = [];
            rows.forEach((row)=>{
                ids.push(row.author);
                urls.push(row.image);
            });
            if (urls.length > 0){
                
                let rdm = Math.floor(Math.random()*urls.length);
                let randomUrl = urls[rdm];
                let uniqueIds = [...new Set(ids.slice(0).sort())];

                interaction.editReply({
                    content: urls.length + " citations sont enregistrées\nIdentifiants : " + uniqueIds.join(' ; '),
                    files: [{
                        attachment: randomUrl
                    }],
                    components:[
                        new Discord.ActionRowBuilder().addComponents(deleteButton)
                    ]
                }).then(() => {
                    requestDeletion(interaction, ids[rdm], randomUrl);
                });
            }
            else return interaction.editReply("Aucune citation n'est enregistrée");
        }
        else return interaction.editReply("Aucune citation n'est enregistrée");
    });
}

async function deleteImage(confirmMessage, identifier, url){
    db.run('DELETE FROM citations WHERE author=? AND image=?', [String(identifier).toLowerCase(), String(url)], 
        (error)=>{
            if (error){
                console.log(error);
            };
        },
        function (){
            if (this.changes > 0) confirmMessage.edit("C'est bon chef, j'ai supprimé la citation de la DB.");
            else confirmMessage.edit("Erreur lors de la suppression de la citation dans la DB.");
        }
    );
}

async function requestDeletion(interaction, identifier, url){
    const filter = i => i.user.id === interaction.user.id && i.customId === 'deleteQuote';

    try {
        let response = await interaction.fetchReply();
        await response.awaitMessageComponent({ filter, time: 10000, max: 1 });
        const confirmMessage = await interaction.followUp({content: 'Êtes-vous sûr de vouloir supprimer cette citation ? (Répondez par "supprimer" pour confirmer, sinon je ne ferai rien)'})
            .catch(console.error);
        await requestDeletionConfirmation(interaction, confirmMessage, identifier, url);
    }
    catch (error) {
        await interaction.editReply({components: []});
    }
}

async function requestDeletionConfirmation(interaction, confirmMessage, identifier, url){
    const filter = msg => msg.author.id === interaction.user.id;

    try{
        const response = await confirmMessage.channel.awaitMessages({ filter, time: 30000, max: 1, errors: ['time'] });
        const m = response.first();
        if (m.content.toLowerCase() == "supprimer"){
            m.delete();
            await deleteImage(confirmMessage, identifier, url);
        }
        else{
            confirmMessage.edit({content: "Ok je laisse couler, mais évite de missclick la prochaine fois... :sleeping:", components: []}).catch(console.error);
        }
    }
    catch (error){
        confirmMessage.edit("Trop tard, je retourne à mes occupations :sleeping:");
    }
    await interaction.editReply({components: []}).catch(console.error);
}

function setupCitationsDatabase(){
    db.run(
		"CREATE TABLE IF NOT EXISTS citations (author text, image text NOT NULL)",
		(e) => {
			if (e) console.log(e);
		}
	);
}