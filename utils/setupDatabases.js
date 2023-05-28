const sqlite3 = require("sqlite3").verbose();
const db = new sqlite3.Database("./database/bot-discord-db.sqlite");

module.exports = {
    setupDatabases
}

function setupDatabases(){
    setupAbsencesDatabase();
    setupCitationsDatabase();
}

function setupAbsencesDatabase(){
    db.run("CREATE TABLE IF NOT EXISTS absences(name TEXT PRIMARY KEY, score INTEGER DEFAULT 0)", (error)=>{
        if (error) return console.log(error);
    });
}

function setupCitationsDatabase(){
    db.run(
		"CREATE TABLE IF NOT EXISTS citations (author text, image text NOT NULL)",
		(e) => {
			if (e) console.log(e);
		}
	);
}