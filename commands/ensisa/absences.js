const Discord = require('discord.js');
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./database/bot-discord-db.sqlite');
const { mainChannel } = require('../../ids/channels-id.json');

module.exports = {
    checkForAbsences,
    data: new Discord.SlashCommandBuilder()
		.setName('absences')
		.setDescription('Manages the absences database.')
        .addSubcommand(subcommand => 
            subcommand
                .setName('new')
                .setDescription('Create a new entry in the database.')
                .addStringOption(option => 
                    option
                    .setName('name')
                    .setDescription('Name of the person to add to the database.')
                    .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('delete')
                .setDescription('Delete an entry from the database.')
                .addStringOption(option =>
                    option
                    .setName('name')
                    .setDescription('Name of the person to delete from the database.')
                    .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('top')
                .setDescription('Display the top 10 of the database.'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('check')
                .setDescription('Check if a person is in the database and display their score.')
                .addStringOption(option =>
                    option
                    .setName('name')
                    .setDescription('Name of the person to check in the database.')
                    .setRequired(true))),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        let name;
        switch (subcommand) {
            case 'new':
                name = interaction.options.getString('name').toLowerCase();
                db.get("SELECT name FROM absences WHERE LOWER(name)=?", [name], (error, row) => {
                    if (error) return log(interaction, error);
                    if (row) return interaction.reply("Déjà dans la base de données.");
                    db.run('INSERT INTO absences(name) VALUES(?)', [name], (error) => {
                        if (error) return log(interaction, error);
                        return interaction.reply("Ajouté " + name + " à la base de données.");
                    });
                });
                break;
            case 'delete':
                name = interaction.options.getString('name').toLowerCase();
                db.get("SELECT name FROM absences WHERE LOWER(name)=?", [name], (error, row) => {
                    if (error) return log(interaction, error);
                    if (!row) return interaction.reply("Pas dans la base de données.");
                    db.run('DELETE FROM absences WHERE LOWER(name)=?', [name], (error) => {
                        if (error) return log(interaction, error);
                        return interaction.reply("Supprimé " + name + " de la base de données.");
                    });
                });
                break;
            case 'top':
                db.all("SELECT * FROM absences ORDER BY score DESC", (error, rows) => {
                    if (error) return log(interaction, error);
                    if (!rows) return interaction.reply("Pas de données.");
                    let reply = "Top 10 :\n";
                    for (let i = 0; i < rows.length; i++) {
                        if (i == 10) break;
                        reply += rows[i].name + " : " + rows[i].score + "\n";
                    }
                    return interaction.reply(reply);
                });
                break;
            case 'check':
                name = interaction.options.getString('name').toLowerCase();
                db.get("SELECT name FROM absences WHERE LOWER(name)=?", [name], (error, row) => {
                    if (error) return log(interaction, error);
                    if (!row) return interaction.reply("Pas dans la base de données.");
                    return interaction.reply(name + " : " + row.score);
                });
                break;
        }
    },
};

async function checkForAbsences(message) {
	if (mainChannel != message.channel.id) return;
    if (
        message.content.split(" ").length != 1 ||
        (!message.content.endsWith("++") && !message.content.endsWith("--"))
    ) return message.reply("Utilisation : <nom>++");

    let name = message.content.slice(0, -2).toLowerCase();
    let score = -1;
    db.get(
        "SELECT score FROM absences WHERE LOWER(name)=?",
        [name],
        (error, row) => {
            if (error) {
                console.log(error);
                return message.reply("Erreur lors de la requête");
            }
            if (row) {
                if (message.content.endsWith("++")) {
                    score = row.score + 1;
                } else if (message.content.endsWith("--")) {
                    score = row.score - 1;
                    if (score < 0) score = 0;
                } else
                    return message.reply(
                        "Erreur lors de la modification du score"
                    );

                db.run(
                    "UPDATE absences SET score=? WHERE LOWER(name)=?",
                    [score, name],
                    (error) => {
                        if (error) {
                            console.log(error);
                            return message.reply(
                                "Erreur lors de la requête"
                            );
                        }
                        return message.reply(
                            (message.content.endsWith("++")
                                ? "Une nouvelle absence pour "
                                : "Une absence de moins pour ") +
                                name +
                                " ! Nouveau score : " +
                                score +
                                " absence(s)"
                        );
                    }
                );
            } else
                return message.reply(
                    "Ce participant n'existe pas, utilise /absences new " +
                        name
                );
        }
    )
}

function log(interaction, error) {
    console.log(error);
    return interaction.reply("Erreur lors de la requête");
}