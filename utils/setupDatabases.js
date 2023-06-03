const { setupAbsencesDatabase } = require('./../commands/ensisa/absences');
const { setupCitationsDatabase } = require('./../commands/ensisa/citation');
const { setupBirthdaysDatabase } = require('./../commands/ensisa/anniv');

module.exports = {
    setupDatabases
}

function setupDatabases(){
    setupAbsencesDatabase();
    setupCitationsDatabase();
    setupBirthdaysDatabase();
}