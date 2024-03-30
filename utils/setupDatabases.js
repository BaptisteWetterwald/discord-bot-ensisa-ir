const { setupAbsencesDatabase } = require('./../commands/ensisa/absences');
const { setupBirthdaysDatabase } = require('./../commands/ensisa/anniv');

module.exports = {
    setupDatabases
}

function setupDatabases(){
    setupAbsencesDatabase();
    setupBirthdaysDatabase();
}