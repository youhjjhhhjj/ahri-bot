// modified from original source: https://discordjs.guide/slash-commands/deleting-commands.html#deleting-all-commands

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

const rest = new REST().setToken(_token);

// for guild-based commands
rest.put(Routes.applicationGuildCommands(abId, serverId), { body: [] })
	.then(() => console.log('Successfully deleted all guild commands.'))
	.catch(console.error);
