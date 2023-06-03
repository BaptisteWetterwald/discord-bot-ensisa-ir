const Discord = require('discord.js');
const sqlite3 = require('sqlite3').verbose();
let db = new sqlite3.Database('./database/bot-discord-db.sqlite');
const { birthdaysChannel } = require('../../ids/channels-id.json');

module.exports = {
    setupBirthdaysDatabase,
    wishBirthdays,
	data: new Discord.SlashCommandBuilder()
		.setName('anniv')
		.setDescription('Anniversaires')
        .addSubcommand(subcommand =>
            subcommand
                .setName('set')
                .setDescription('Ajoute ou modifie votre date d\'anniversaire.')
                .addStringOption(option =>
                    option.setName('date')
                        .setDescription('Date de naissance au format YYYY-MM-DD.')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('next')
                .setDescription('Affiche les anniversaires à venir.')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('remove')
                .setDescription('Supprime votre date d\'anniversaire.')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('Affiche toutes les dates d\'anniversaire.')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('help')
                .setDescription('Affiche l\'aide.')
        )
        .setDMPermission(false),
	async execute(interaction) {
        await interaction.deferReply();

        const subcommand = interaction.options.getSubcommand();
        switch (subcommand) {
            case 'set':
                setBirthday(interaction);
                break;
            case 'next':
                displayNextBirthdays(interaction);
                break;
            case 'remove':
                removeBirthday(interaction);
                break;
            case 'list':
                displayAllBirthdays(interaction);
                break;
            case 'help':
                displayHelp(interaction);
                break;
            default:
                console.log(`[ERROR] Unknown subcommand ${subcommand}.`);
                break;
        }
    }
};

function setBirthday(interaction) {
    const userId = interaction.user.id;
    const date = interaction.options.getString('date');
    const dateRegex = new RegExp('^(19|20)[0-9]{2}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$');
    if (!dateRegex.test(date) || !isValidDate(date)) {
        interaction.editReply(`:x: Format de date invalide. Veuillez utiliser le format YYYY-MM-DD.`);
        return;
    }
    db.run('INSERT OR REPLACE INTO birthdays (user_id, date) VALUES (?, ?)', [userId, date], function(err) {
        if (err) {
            console.log(`[ERROR] ${err.message}`);
            interaction.editReply(`:x: Une erreur est survenue lors de l'ajout de votre date d'anniversaire.`);
        } else {
            interaction.editReply(`:white_check_mark: Votre date d'anniversaire a bien été ajoutée/modifiée.`);
        }
    });
}

function isValidDate(date) {
    const today = new Date();
    const dateObject = new Date(date);
    // verify that the date is at least 15 years ago
    const fifteenYearsAgo = new Date(today.getFullYear() - 15, today.getMonth(), today.getDate());
    return dateObject <= fifteenYearsAgo;
}

// Returns birthdays that are today or in the next 31 days
function displayNextBirthdays(interaction) {
    const today = new Date().toISOString().slice(0, 10);
    db.all('SELECT user_id, date FROM birthdays ORDER BY date ASC', [], function(err, rows) {
        if (err) {
            console.log(`[ERROR] ${err.message}`);
            interaction.editReply(`:x: Une erreur est survenue lors de la récupération des dates d'anniversaire.`);
        } else {
            let message = '';
            if (rows.length === 0) {
                message = `:x: Aucune date d'anniversaire n'a été enregistrée.`;
            } else {
                
                // get birthdays that are between today and 31 days from now without minding the year
                const birthdays = rows.filter(birthday => {
                    const birthdayDate = birthday.date.substring(5);
                    const todayDate = today.substring(5);
                    
                    // get dates with the same year as today
                    const birthdayDateWithYear = today.substring(0, 5) + birthdayDate;
                    const todayDateWithYear = today.substring(0, 5) + todayDate;

                    // check if birthday is between today and 31 days from now using Date objects
                    const birthdayDateObject = new Date(birthdayDateWithYear);
                    const todayDateObject = new Date(todayDateWithYear);
                    const thirtyOneDaysFromNowDateObject = new Date(todayDateObject);
                    thirtyOneDaysFromNowDateObject.setDate(todayDateObject.getDate() + 31);
                    const valid = birthdayDateObject >= todayDateObject && birthdayDateObject <= thirtyOneDaysFromNowDateObject;
                    
                    return valid;
                });

                if (birthdays.length === 0) {
                    message = `:x: Pas d'anniversaire dans les 31 prochains jours.`;
                }
                else {
                    message = `:birthday: Anniversaires dans les 31 prochains jours :\n`;
                    
                    // sort birthdays by date (soonest first)
                    const sortedBirthdays = birthdays.sort((a, b) => {
                        const aDate = a.date.substring(5);
                        const bDate = b.date.substring(5);
                        return aDate.localeCompare(bDate);
                    });

                    // add birthdays to message
                    sortedBirthdays.forEach(birthday => {
                        let age = getAge(birthday.date);
                        const user = interaction.guild.members.cache.get(birthday.user_id);

                        // format date as "JJ mois"
                        const date = birthday.date.substring(8, 10);
                        const month = birthday.date.substring(5, 7);
                        const monthName = getMonthName(month);
                        birthday.date = `${date} ${monthName}`;

                        // age after birthday has passed (today included)
                        if (today.substring(5) >= birthday.date) {
                            age++;
                        }

                        message += `:small_blue_diamond: ${user} : ${birthday.date} (il/elle aura ${age} ans)\n`;
                    });

                    // remove last \n
                    message = message.substring(0, message.length - 1);
                }
            }
            interaction.editReply(message);
        }
    });
}

function getAge(date) {
    const today = new Date();
    const birthDate = new Date(date);
    let age = today.getFullYear() - birthDate.getFullYear();
    const month = today.getMonth() - birthDate.getMonth();
    if (month < 0 || (month === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }
    return age;
}

function getMonthName(month) {
    switch (month) {
        case '01':
            return 'janvier';
        case '02':
            return 'février';
        case '03':
            return 'mars';
        case '04':
            return 'avril';
        case '05':
            return 'mai';
        case '06':
            return 'juin';
        case '07':
            return 'juillet';
        case '08':
            return 'août';
        case '09':
            return 'septembre';
        case '10':
            return 'octobre';
        case '11':
            return 'novembre';
        case '12':
            return 'décembre';
        default:
            return '';
    }
}

function removeBirthday(interaction) {
    const userId = interaction.user.id;
    db.run('DELETE FROM birthdays WHERE user_id = ?', [userId], function(err) {
        if (err) {
            console.log(`[ERROR] ${err.message}`);
            interaction.editReply(`:x: Une erreur est survenue lors de la suppression de votre date d'anniversaire.`);
        } else {
            interaction.editReply(`:white_check_mark: Votre date d'anniversaire a bien été supprimée.`);
        }
    });
}

function displayAllBirthdays(interaction) {
    db.all('SELECT user_id, date FROM birthdays ORDER BY date ASC', [], function(err, rows) {
        if (err) {
            console.log(`[ERROR] ${err.message}`);
            interaction.editReply(`:x: Une erreur est survenue lors de la récupération des dates d'anniversaire.`);
        } else {
            let message = '';
            if (rows.length === 0) {
                message = `:x: Aucune date d'anniversaire n'a été enregistrée.`;
            } else {
                message = `:birthday: Anniversaires :\n`;
                // sort birthdays by date (soonest first)
                const sortedBirthdays = rows.sort((a, b) => {
                    const aDate = a.date.substring(5);
                    const bDate = b.date.substring(5);
                    return aDate.localeCompare(bDate);
                });
                // add birthdays to message
                sortedBirthdays.forEach(birthday => {
                    let age = getAge(birthday.date);
                    const user = interaction.guild.members.cache.get(birthday.user_id);

                    // format date as "JJ mois"
                    const date = birthday.date.substring(8, 10);
                    const month = birthday.date.substring(5, 7);
                    const monthName = getMonthName(month);
                    birthday.date = `${date} ${monthName}`;


                    const today = new Date().toISOString().slice(0, 10);

                    // age after birthday has passed (today included)
                    if (today.substring(5) >= birthday.date) {
                        age++;
                    }

                    message += `:small_blue_diamond: ${user} : ${birthday.date} (il/elle aura ${age} ans)\n`;
                });
                // remove last \n
                message = message.substring(0, message.length - 1);
            }
            interaction.editReply(message);
        }
    });
}

function displayHelp(interaction) {
    const message = `:birthday: **Commandes disponibles :**\n\n` +
        `:small_blue_diamond: \`/anniv set <date>\` : Ajoute votre date d'anniversaire (format : \`AAAA-MM-JJ\`).\n` +
        `:small_blue_diamond: \`/anniv remove\` : Supprime votre date d'anniversaire.\n` +
        `:small_blue_diamond: \`/anniv next\` : Affiche les anniversaires à venir dans les 31 prochains jours.\n` +
        `:small_blue_diamond: \`/anniv list\` : Affiche toutes les dates d'anniversaire.\n` +
        `:small_blue_diamond: \`/anniv help\` : Affiche ce message d'aide.\n\n`;

    interaction.editReply(message);
}

function checkBirthday(birthday, today) {
    return birthday.date.substring(5) === today.substring(5);
}

function setupBirthdaysDatabase() {
    db.run('CREATE TABLE IF NOT EXISTS birthdays (user_id TEXT PRIMARY KEY, date TEXT NOT NULL)', 
        (err) => {
            if (err) console.log(`[ERROR] ${err.message}`);
        }
    );
}

function wishBirthdays(client) {
    const today = new Date().toISOString().slice(0, 10);
    db.all('SELECT user_id, date FROM birthdays ORDER BY date ASC', [], function(err, rows) {
        if (err) {
            console.log(`[ERROR] ${err.message}`);
        } else {
            const birthdays = rows.filter(birthday => checkBirthday(birthday, today));

            let message = '';
            if (birthdays.length > 0) {
                message = `:birthday: Joyeux anniversaire `;
                birthdays.forEach(function (birthday) {
                    message += `<@${birthday.user_id}> `;
                });
                message += `:birthday:`;
                client.channels.cache.get(birthdaysChannel).send(message);
            }
        }
    });
}