// modified from original source: https://discordjs.guide/creating-your-bot/command-deployment.html#command-registration

const fs = require('fs');
const path = require('path');
const { REST, Routes } = require('discord.js');

const { abId, serverId } = require('../globals.js');

let _token = ""
try {
    // local login
    let { token } = require('../token.json');
    _token = token;
}
catch (error) {
    // cloud login
    _token = process.env.DISCORD_TOKEN;
}

const commands = [];
const commandsDir = path.join(path.resolve(path.dirname(__dirname)), 'commands');
const commandFiles = fs.readdirSync(commandsDir).filter(file => file.endsWith('.js'));
// Grab the SlashCommandBuilder#toJSON() output of each command's data for deployment
for (const file of commandFiles) {
    let command = require(path.join(commandsDir, file));
    if ('data' in command && 'execute' in command) {
        commands.push(command.data.toJSON());
        console.log(`Successfully loaded command at ${file}`);
    }
    else {
        console.error(`Failed to load command at ${file}`);
    }
}

// Construct and prepare an instance of the REST module
const rest = new REST().setToken(_token);

// and deploy your commands!
(async () => {
	try {
		console.log(`Started refreshing ${commands.length} application (/) commands.`);

		// The put method is used to fully refresh all commands in the guild with the current set
		const data = await rest.put(
			Routes.applicationGuildCommands(abId, serverId),
			{ body: commands },
		);

		console.log(`Successfully reloaded ${data.length} application (/) commands.`);
	}
    catch (error) {
		// And of course, make sure you catch and log any errors!
		console.error(error);
	}
})();
