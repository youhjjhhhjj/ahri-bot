'use strict';

const fs = require('fs');
const path = require('path');
var https = require('https');
var http = require('http');
var qs = require('querystring');
const { Collection, Events } = require('discord.js');

// importing from other files
const { debugChannelId, modChannelId, protectedChannelIds, staffIds, vstaffIds, abClient, pgClient } = require('./globals.js');
const { doMessageVote, bonk } = require('./moderation.js');
const { receiveDonation, registerVote, verifyUser, embed, checkCredit, useCredit } = require('./campaign.js');

// setting commands
const { commands } = require('./commands.js');
const commandsMap = new Collection();
commandsMap.set(commands.test.name, async (interaction) => await interaction.reply('👍'));
commandsMap.set(commands.stick.name, stick);
commandsMap.set(commands.unstick.name, unstick);
commandsMap.set(commands.embed.name, async (interaction) => await embed().then(() => interaction.reply({content: "Successfully created embed.", ephemeral: true})));
commandsMap.set(commands.anon.name, anon);
commandsMap.set(commands.timeout.name, timeout);
commandsMap.set(commands.deleteMessage.name, deleteMessage);

const stickHeader = "__**Stickied Message:**__\n";

const anons = new Collection();

// discord login
let _token = "";
try {
    // local login
    let { token } = require('./token.json');
    _token = token;
}
catch (error) {
    // cloud login
    _token = process.env.DISCORD_TOKEN;
}
abClient.login(_token);

// connect to database
pgClient
  .connect()
  .then(() => console.log('connected'))
  .catch(err => console.error('connection error', err.stack));

// populate stick messages
const stickMessages = new Map();  // channelId: [messageId, contents]
// CREATE TABLE StickyMessages ( channel_id VARCHAR(255) PRIMARY KEY, message_id VARCHAR(255) UNIQUE, message_content TEXT ) ;
pgClient.query(`SELECT * FROM StickyMessages`).then(data => {
    console.log(data.rows);
    data.rows.forEach(row => {
        stickMessages.set(row['channelId'], [row['messageId'], row['messageContent']]);
    })
}).catch(err => console.error(err.stack));

const PORT = process.env.PORT || 4000;

var campaign = -1;  // -1 if no campaign, 0 if vote campaign, > 0 if goal campaign (price)


http.createServer(async function(req, res) {
    try {
        receiveDonation(req, res, campaign);
    }
    catch (err)
    {
        console.error(err.stack);
        res.writeHead(500);;
        res.end();
    }    
}).listen(PORT); 


async function talk(message) {
    return new Promise((resolve, reject) => {
        var postData = JSON.stringify({
            'prompt': message,
            'max_tokens': 200
        });    
        var options = {
            hostname: "api.cohere.ai",
            path: "/v1/generate",
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'Authorization': "Bearer RQFHrtyLOClxW0SHEKYokn6UBUBlefpeeG7MAzqm"
            }
        };    
        let response = []    ;
        var req = https.request(options, (res) => {      
            if (res.statusCode < 200 || res.statusCode > 299) {
                // console.log(res)
                reject('<:rengar_confusion:1115059377297178696>');
                return;
            }  
            res.on('data', (d) => {
                response.push(d);
            });
            res.on('end', (d) => {
                let reply = JSON.parse(Buffer.concat(response).toString().trim())['generations'][0]['text'];
                // let length = Math.max(reply.lastIndexOf('.'), reply.lastIndexOf('?'), reply.lastIndexOf('!'))
                // if (length > -1) reply = reply.slice(0, length + 1)
                resolve(reply);
                return;
            })
        });    
        
        req.on('error', (e) => {
            console.error(e);
            reject("Ahri Bot broke.");
        });    
        req.write(postData);
        req.end();
    });
}

async function stick(interaction) {
    let messageId = interaction.options.getString('message_id');
    let message = await interaction.channel.messages.fetch(messageId);
    message.channel.send(stickHeader + message.content).then((stickMessage) => {
        stickMessages.set(stickMessage.channelId, [stickMessage.id, message.content]);  // update map with message id
        message.channel.messages.delete(messageId);  // delete original message
        // add to database
        pgClient.query(`INSERT INTO StickyMessages VALUES ( $1, $2, $3 ) ;`, [stickMessage.channelId, stickMessage.id, message.content]).catch(err => console.error(err.stack));
    })
    .catch(err => console.error(err.stack));
    await interaction.reply({content: "Successfully sticked message.", ephemeral: true});
}

async function unstick(interaction) {
    message.channel.messages.delete(stickMessages.get(interaction.channelId)[0]);  // delete stick message
    stickMessages.delete(message.channelId);  // update map
    // remove from database
    pgClient.query(`DELETE FROM StickyMessages WHERE channel_id = $1 ;`, [interaction.channelId]);
    await interaction.reply({content: "Successfully unsticked message.", ephemeral: true});
}

async function anon(interaction) {
    let messageContent = interaction.options.getString('message');
    if (anons.has(interaction.user.id) && interaction.createdTimestamp - anons.get(interaction.user.id) < 5 * 60 * 1000) {
        console.log(`${interaction.user.tag} tried to send anonymously: ${messageContent}`);
        let remainingTime = 5 * 60 - Math.trunc(interaction.createdTimestamp / 1000 - anons.get(interaction.user.id) / 1000);
        await interaction.reply({content: `You must wait ${remainingTime} seconds before doing this again.`, ephemeral: true});
        return;
    }
    console.log(`${interaction.user.tag} sent anonymously: ${messageContent}`);
    await interaction.channel.send(messageContent);
    anons.set(interaction.user.id, interaction.createdTimestamp);
    await interaction.reply({content: "Sent anonymous message.", ephemeral: true});
}

// TODO move to moderation commands file
async function timeout(interaction) {
    let duration = interaction.options.getInteger('duration');
    let member = interaction.options.getMember('member');
    await member.timeout(1000 * 60 * duration);
    abClient.channels.cache.get(modChannelId).send(`${member.user.toString()} has been timed out for ${duration} minutes by ${interaction.user.tag}.`);
    interaction.channel.send(`${member.user.tag} has been timed out for ${duration} minutes by a moderator.`);
    await interaction.reply({content: "Successfully timed out user.", ephemeral: true});
}

async function deleteMessage(interaction) {
    let messageId = interaction.options.getString('message_id');
    let message = await interaction.channel.messages.fetch(messageId);
    if (!message) {
        await interaction.reply({content: "Message could not be found.", ephemeral: true});
        return;
    }
    await message.delete();
    abClient.channels.cache.get(modChannelId).send(`A message by ${message.author.toString()} in ${interaction.channel.toString()} has been deleted by ${interaction.user.tag}.`);
    interaction.channel.send(`A message has been deleted by a moderator.`);
    await interaction.reply({content: "Successfully deleted message.", ephemeral: true});
}


abClient.on(Events.ClientReady, async () =>
{
    console.log(`Logged in as ${abClient.user.username}`);
    abClient.user.setPresence({ activities: [{ name: '/help' }], status: 'online' });
});

abClient.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    let command = commandsMap.get(interaction.commandName);
	if (!command) {
		console.error(`No command matching ${interaction.commandName} was found.`);
		return;
	}
    try {
		await command(interaction);
	} 
    catch (error) {
		console.error(error);
		await interaction.reply({ content: 'There was an error while executing this command.', ephemeral: true });
	}
});

abClient.on(Events.MessageCreate, async (message) =>
{
    if(message.author.bot || message.webhookId) return;

    // DMs

    if(!message.guild)
    {
        console.log(`${message.author.tag}: ${message.content}`);
        // try {
        //     let contents = message.content.trim();
        //     let debugChannel = abClient.channels.cache.get(debugChannelId);
        //     if(!debugChannel) return console.log("Failed to find channel");
        //     debugChannel.send(`${message.author.tag}: ${message.content}`);
            // let response = "Unrecognized command.";
            // if (/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/.test(contents)) response = await verifyUser(debugChannel, contents.toLowerCase(), message.author.id, message.author.tag);
            // else if (campaign == 0 && vote_options.includes(parseInt(contents))) response = await registerVote(debugChannel, message.author.id, message.author.tag, contents);
            // else if (campaign > 0 && contents.toLowerCase() === "use credit") response = await useCredit(message.author.id, message.author.tag);
            // else if (contents.toLowerCase() === "check credit") response = await checkCredit(message.author.id);
            // abClient.users.fetch(message.author.id, false).then((user) => {
            //     user.send(response);
            // });
        // }
        // catch (err)
        // {
        //     console.error(err.stack);
        // }
        return;
    }


    // server messages

    // if(message.guild && message.channel.id == debugChannelId) console.log(message)  // debug

    if (campaign > 0 && message.channelId == '747784406801842196') {  // commission-request
        if (!message.content || message.content.length < 1 || message.attachments.size < 1) {
            message.delete();
            return;
        }
        else {
            message.react('🔼').then(() => message.react('🔽'));
        }
    }

    // message vote
    if (message.reference !== null && (message.content === '⬇️' || message.content === '⬆️')) {       
        message.fetchReference().then(fetched_message => doMessageVote(fetched_message, message.author.id, message.content));
    }

    // sticky message
    if (stickMessages.has(message.channelId))
    {
        message.channel.messages.delete(stickMessages.get(message.channelId)[0]).catch(e => console.error(e.stack));
        message.channel.send(stickHeader + stickMessages.get(message.channelId)[1])
        .then(sent_message => {
            stickMessages.get(message.channelId)[0] = sent_message.id;
            pgClient.query(`UPDATE StickyMessages SET message_id = $1 WHERE channel_id = $2 ;`, [sent_message.id, message.channelId]).catch(e => console.error(e.stack));
        })  // update map and database with new message id
        .catch(e => console.error(e.stack));
    }

    // talk    
    if (!protectedChannelIds.has(message.channelId) && message.mentions.has(abClient.user)) talk(`@${message.author.username}: ${message.cleanContent.trim()} \n @Ahri Bot: `).then((response) => message.reply(response)).catch((response) => message.reply(response));
});


abClient.on(Events.MessageReactionAdd, async (reaction, user) => {
    // console.log(reaction)  // debug
    if (reaction.emoji.name === '⬇️' || reaction.emoji.name === '⬆️') {
        doMessageVote(reaction.message, user.id, reaction.emoji.name);
    }
    else if (reaction.emoji.name === 'bonk' && reaction.message.channelId != '1139191006890299463' && reaction.count >= 5) {
        bonk(reaction.message);
    }
    else if (reaction.emoji.name === '🆓' && protectedChannelIds.has(reaction.message.channelId)) reaction.remove();
});
