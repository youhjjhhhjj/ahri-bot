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

const { commands } = require('../commands.js');
const commandsList = [];
// Grab the SlashCommandBuilder#toJSON() output of each command's data for deployment
for (let command in commands) {
    commandsList.push(commands[command].toJSON());
    console.log(`Successfully loaded command ${command}`);
}

// Construct and prepare an instance of the REST module
const rest = new REST().setToken(_token);

// and deploy your commands!
(async () => {
	try {
		console.log(`Started refreshing ${commandsList.length} application (/) commands.`);

		// The put method is used to fully refresh all commands in the guild with the current set
		const data = await rest.put(
			Routes.applicationGuildCommands(abId, serverId),
			{ body: commandsList },
		);

		console.log(`Successfully reloaded ${data.length} application (/) commands.`);
	}
    catch (error) {
		// And of course, make sure you catch and log any errors!
		console.error(error);
	}
})();
