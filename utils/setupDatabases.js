const { setupAbsencesDatabase } = require('./../commands/ensisa/absences');
const { setupBirthdaysDatabase } = require('./../commands/ensisa/anniv');
const { setupPromptsDatabase } = require('./../commands/fun/chadgpt');

module.exports = {
    setupDatabases
}

function setupDatabases(){
    setupAbsencesDatabase();
    setupBirthdaysDatabase();
    setupPromptsDatabase();
}