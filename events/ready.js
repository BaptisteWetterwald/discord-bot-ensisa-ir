const { Events } = require('discord.js');

module.exports = {
	name: Events.ClientReady,
	once: true,
	async execute(client) {

		// for all guilds, fetch all channels and all users to update cache
		await client.guilds.cache.forEach(guild => {
			guild.channels.fetch();
			guild.members.fetch();
		});
		
		process.env.TZ = 'Europe/Paris';

		console.log(`Ready! Logged in as ${client.user.tag}`);
		
		client.user.setPresence({
			activities: [{ name: "Ketchup + mayo = goulag" }],
			status: "online",
		});

	},
};


/*async function findCitations(client) {
	// read file at './messages.html'
	const filePath = path.resolve('./events/messages.html');

	const browser = await puppeteer.launch({
        headless: "new",
        args:[
            '--no-sandbox'
        ]
    });

	const page = await browser.newPage();
	await page.goto(filePath);

	await page.evaluate(() => {	
		
		let citations = [];
		let anchors = document.querySelectorAll('a');
		for (let i = 0; i < anchors.length; i++) {
			let anchor = anchors[i];
			let parentDiv = anchor.parentElement.parentElement;
			if (!parentDiv.querySelector('.message')) {
				continue;
			}

			let username = parentDiv.querySelector('.username');
			let paragraph = parentDiv.querySelector('p');

			let citation = {
				author: username ? username.textContent : "",
				content: paragraph ? paragraph.textContent : "",
				imageSrc: anchor.href
			};
			citations.push(citation);
		}
		
		return citations;

	}).then((result) => {
		console.log(result);

		for (let citation of result) {
			// download image to local storage
			let imageSrc = citation.imageSrc;
			let name = imageSrc.split('/').pop();
			name = name.split('attachments').pop();
			name = name.split('get-downloaded-file').pop();
			name = name.split('%3F')[0];
			name = name.split('%2F').pop();
			if (name.includes('%252F')) continue;
			if (name.includes('male')) continue;

			let invalidStarts = ['THOMESH_', 'Transformot_', 'Abdel_', 'Nathan_Fallet_', 'Gutygeit_', 'HBQUT_', 'Fluffy_Bunny_', 'Baptiste_']
			if (invalidStarts.some((start) => name.startsWith(start))) continue;
			
			console.log("Name:" + name);

			let path = './events/citations/' + name;
			downloadFile(imageSrc, path).then(() => {
				//console.log("Downloaded " + imageSrc + " to " + path);
			}).catch((err) => {
				console.error(err);
			});
		}

	}).catch((err) => {
		console.error(err);
	});

	await browser.close();
}

async function downloadFile(url, targetFile) { // copied from https://futurestud.io/tutorials/node-js-how-to-download-a-file
    return await new Promise((resolve, reject) => {

		let lib = url.startsWith('https') ? https : http;

        lib.get(url, response => {
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

			if (fs.existsSync(targetFile)) {
				let name = targetFile.split('/').pop();
				let newTargetFile = targetFile.split(name)[0] + "_" + name;
				return resolve(
					downloadFile(url, newTargetFile)
				);
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
}*/