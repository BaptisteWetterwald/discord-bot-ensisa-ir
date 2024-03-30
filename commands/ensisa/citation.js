const Discord = require('discord.js');
const deleteButtonId = 'deleteQuote';
const fs = require('fs');
const pathMod = require('node:path');
const quotationsFolder = pathMod.resolve('./images/citations/').replace(/\\/g, '/') + '/';
const https = require('https');

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

                // get the part of the url before the last '?' character
                let attachmentUrl = attachment.url.split('?')[0];
                if (!(
                        attachmentUrl.endsWith('.png')
                        || attachmentUrl.endsWith('.jpg')
                        || attachmentUrl.endsWith('.jpeg')
                    )) return interaction.editReply('Les fichiers joints doivent être des images.');
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

async function storeImages(identifier, urls, interaction){
    let params = [];
    let id = String(identifier).toLowerCase();
    for (let url of urls){
        params.push(id);
        params.push(String(url));
    }

    let folder = quotationsFolder + id;
    if (!fs.existsSync(folder)){
        fs.mkdirSync(folder);
    }

    let nbFilesBefore = fs.readdirSync(folder).length;

    for (let i = 0; i < urls.length; i++){
        let nbFiles = fs.readdirSync(folder).length;
        let extension = urls[i].split('.').pop().split('?')[0];
        let path = folder + '/' + (nbFiles + 1) + '.' + extension;
        await downloadFile(urls[i], path);
    }

    let nbFilesAfter = fs.readdirSync(folder).length;
    if (nbFilesAfter > nbFilesBefore){
        interaction.editReply("Ajouté " + (nbFilesAfter - nbFilesBefore) + " citation(s) à la DB.");
    }
    else{
        interaction.editReply("Erreur lors de l'enregistrement d'une image dans la DB.");
    }
};

async function sendImage(interaction, identifier, index){
    let id = String(identifier).toLowerCase();
    let folder = quotationsFolder + id;
    if (!fs.existsSync(folder)){
        return interaction.editReply("Il n'y a pas de citation associée à cet identifiant");
    }

    let files = fs.readdirSync(folder);
    if (files.length > 0){
        let chosenIndex;
        if (index != null){
            let indexAsNum = Number(index);
            if (Number.isInteger(indexAsNum) && indexAsNum >= 1 && indexAsNum <= files.length) chosenIndex = indexAsNum;
            else return interaction.editReply('L\'index doit être compris entre 1 et ' + files.length);
        }
        else chosenIndex = Math.floor(Math.random()*files.length) + 1;
        let path = folder + '/' + chosenIndex + '.' + files[chosenIndex - 1].split('.').pop();
        interaction.editReply({
            content: "Cet identifiant a " + files.length + " citation(s) associée(s). Index actuel : " + chosenIndex,
            files: [path],
            components:[
                new Discord.ActionRowBuilder().addComponents(deleteButton)
            ]
        }).then(() => {
            requestDeletion(interaction, id, chosenIndex);
        });
    }
    else return interaction.editReply("Il n'y a pas de citation associée à cet identifiant");
}

async function sendRandomImage(interaction){
    let folders = fs.readdirSync(quotationsFolder);
    if (folders.length > 0){
        let rdmFolder = Math.floor(Math.random()*folders.length);
        let folder = folders[rdmFolder];
        let files = fs.readdirSync(quotationsFolder + folder);
        if (files.length > 0){
            let rdm = Math.floor(Math.random()*files.length) + 1;
            let path = quotationsFolder + folder + '/' + rdm + '.' + files[rdm - 1].split('.').pop();

            // get total number of citations
            let total = 0;
            let uniqueIds = [];
            for (let folderIter of folders){
                let name = folderIter.split('/').pop();
                if (folderIter == folder) name += ' (actuel)';
                uniqueIds.push(name);
                let files = fs.readdirSync(quotationsFolder + folderIter);
                total += files.length;
            }

            interaction.editReply({
                content: total + " citations sont enregistrées.\nIdentifiants : " + uniqueIds.join(' ; '),
                files: [path],
                components:[
                    new Discord.ActionRowBuilder().addComponents(deleteButton)
                ]
            }).then(() => {
                requestDeletion(interaction, folder.split('/').pop(), rdm);
            });
        } 
        else {
            fs.rmdirSync(quotationsFolder + folder);
            sendRandomImage(interaction);
        }
    }
    else return interaction.editReply("Aucune citation n'est enregistrée");
}

async function deleteImage(confirmMessage, identifier, index){
    let folder = quotationsFolder + identifier;
    let files = fs.readdirSync(folder);
    let path = folder + '/' + index + '.' + files[index - 1].split('.').pop();
    fs.unlink(path, (error) => {
        if (error){
            console.log(error);
            return confirmMessage.edit("Erreur lors de la suppression de la citation dans la DB.");
        }

        files = fs.readdirSync(folder);
        if (files.length == 0){
            fs.rmdirSync(folder);
        }
        else{
            for (let i = index; i < files.length; i++){
                let oldPath = folder + '/' + (i + 1) + '.' + files[i].split('.').pop();
                let newPath = folder + '/' + i + '.' + files[i].split('.').pop();
                fs.rename(oldPath, newPath, (error) => {
                    if (error){
                        console.log(error);
                        return confirmMessage.edit("Erreur lors de la suppression de la citation dans la DB.");
                    }
                });
            }
        }

        confirmMessage.edit("C'est bon chef, j'ai supprimé la citation de la DB.");
    });
}

async function requestDeletion(interaction, identifier, index){
    const filter = i => i.user.id === interaction.user.id && i.customId === 'deleteQuote';

    try {
        let response = await interaction.fetchReply();
        await response.awaitMessageComponent({ filter, time: 10000, max: 1 });
        const confirmMessage = await interaction.followUp({content: 'Êtes-vous sûr de vouloir supprimer cette citation ? (Répondez par "supprimer" pour confirmer, sinon je ne ferai rien)'})
            .catch(console.error);
        await requestDeletionConfirmation(interaction, confirmMessage, identifier, index);
    }
    catch (error) {
        await interaction.editReply({components: []});
    }
}

async function requestDeletionConfirmation(interaction, confirmMessage, identifier, index){
    const filter = msg => msg.author.id === interaction.user.id;

    try{
        const response = await confirmMessage.channel.awaitMessages({ filter, time: 30000, max: 1, errors: ['time'] });
        const m = response.first();
        if (m.content.toLowerCase() == "supprimer"){
            m.delete();
            await deleteImage(confirmMessage, identifier, index);
        }
        else{
            confirmMessage.edit({content: "Ok je laisse couler, mais évite de missclick la prochaine fois... :sleeping:", components: []}).catch(console.error);
        }
    }
    catch (error){
        console.error(error);
        confirmMessage.edit("Trop tard, je retourne dormir :sleeping:");
    }
    await interaction.editReply({components: []}).catch(console.error);
}

async function downloadFile(url, targetFile) { // copied from https://futurestud.io/tutorials/node-js-how-to-download-a-file
    return await new Promise((resolve, reject) => {
        https.get(url, response => {
            const code = response.statusCode ?? 0
    
            if (code >= 400) {
                return reject(new Error(response.statusMessage))
            }
    
            // handle redirects
            if (code > 300 && code < 400 && !!response.headers.location) {
                return resolve(
                    downloadFile(response.headers.location, targetFile)
                )
            }
    
            // save the file to disk
            const fileWriter = fs
                .createWriteStream(targetFile)
                .on('finish', () => {
                    resolve({})
                })
    
            response.pipe(fileWriter)
        }).on('error', error => {
            reject(error)
        })
    })
}