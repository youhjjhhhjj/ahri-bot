'use strict';

const fs = require('fs');
const path = require('path');
var https = require('https');
var http = require('http');
const { ActionRowBuilder, Collection, Events } = require('discord.js');

// importing from other files
const { abId, serverId, debugChannelId, modChannelId, protectedChannelIds, staffIds, vstaffIds, abClient, pgClient } = require('./globals.js');
const { doMessageVote, doVoteBonk, moderatorBonk, timeout, deleteMessage } = require('./moderation.js');
const { receiveDonation, registerVote, verifyUser, startCampaign, endCampaign, checkCredit, useCredit } = require('./campaign/campaign.js');

// setting commands
const { commands } = require('./commands.js');
const commandsMap = new Collection();
commandsMap.set(commands.test.name, async (interaction) => await interaction.reply('👍'));
commandsMap.set(commands.stick.name, stick);
commandsMap.set(commands.unstick.name, unstick);
commandsMap.set(commands.startCampaign.name, startCampaign);
commandsMap.set(commands.endCampaign.name, endCampaign);
commandsMap.set(commands.anon.name, anon);
commandsMap.set(commands.timeout.name, timeout);
commandsMap.set(commands.deleteMessage.name, deleteMessage);
commandsMap.set(commands.bonk.name, moderatorBonk);

const { buttons } = require('./buttons.js');
const buttonsMap = new Collection();
buttonsMap.set(buttons.getArtistRole.data.custom_id, async (interaction) => {
    interaction.member.roles.add('1191146819749695568');
    console.log(`${interaction.user.tag} self-assigned a role`);
    await interaction.reply({content: "Role assigned successfully.", ephemeral: true});
});
buttonsMap.set(buttons.getModderRole.data.custom_id, async (interaction) => {
    let modChannel = abClient.channels.cache.get(modChannelId);
    if(!modChannel) return console.log("Failed to find channel");
    modChannel.send(`${interaction.user.toString()} has requested Modder role.`);
    await interaction.reply({content: "Role request submitted.", ephemeral: true});
});

const stickyHeader = "__**Stickied Message:**__\n";

const anonUsers = new Collection();
const anonMessages = new Collection();

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
const stickyMessages = new Map();  // channelId: messageId
// CREATE TABLE sticky_messages ( channel_id VARCHAR(255) PRIMARY KEY, message_id VARCHAR(255) ) ;
pgClient.query(`SELECT * FROM sticky_messages`).then(data => {
    data.rows.forEach(row => {
        stickyMessages.set(row['channel_id'], row['message_id']);
    })
}).catch(err => console.error(err.stack));

var stickyLock = new Set();  // channelId

const PORT = process.env.PORT || 4000;


http.createServer(async function(req, res) {
    try {
        receiveDonation(req, res);
    }
    catch (err)
    {
        console.error(err.stack);
        res.writeHead(500);
        res.end();
    }    
}).listen(PORT);


async function formatPrompt(message) {
    let prompt = `${message.author.username}: ${message.cleanContent.trim()}`;
    if (message.reference !== null) {
        let replyMessage = await message.fetchReference();
        prompt = `${replyMessage.author.username.replace("Ahri Bot", "Ahri")}: ${replyMessage.content}\n` + prompt;
    }
    return `Below is an instruction that describes a task. Write a response that appropriately completes the request.\n### Instruction:\nGenerate how Ahri would respond to this chat.\n${prompt}\n### Response:\nAhri: `;
}

async function talk(prompt) {
    console.log(prompt);
    return new Promise((resolve, reject) => {
        var postData = JSON.stringify({
            "model": "undi95/toppy-m-7b:free",
            "max_tokens": 256,
            "prompt": prompt,
        });
        var options = {
            hostname: "openrouter.ai",
            path: "/api/v1/chat/completions",
            method: 'POST',
            headers: {
                  'Accept': 'application/json',
                  'Content-Type': 'application/json',
                  'Authorization': '',
            }
        }; 
        let response = []    ;
        var req = https.request(options, (res) => {      
            if (res.statusCode < 200 || res.statusCode > 299) {
                console.error(res.statusCode, res.headers);
                reject();
                return;
            }  
            res.on('data', (d) => {
                response.push(d);
            });
            res.on('end', (d) => {
                // console.log(JSON.stringify(JSON.parse(Buffer.concat(response).toString().trim())))
                try {
                    let reply = JSON.parse(Buffer.concat(response).toString().trim())["choices"][0]["text"];
                    console.log(reply);
                    resolve(reply);
                    return;
                }
                catch (e) {
                    console.log(JSON.stringify(JSON.parse(Buffer.concat(response).toString().trim())))
                    console.error(e);
                    reject();
                }
            })
        });        
        req.on('error', (e) => {
            console.error(e);
            reject();
        });    
        req.write(postData);
        req.end();
    });
}

async function stick(interaction) {
    let messageId = interaction.options.getString('message_id');
    let message = await interaction.channel.messages.fetch(messageId);
    let messageObject = {
        content: message.content,
        embeds: message.embeds,
        components: message.components,
        attachments: message.attachments,
        stickers: message.stickers,
    }
    messageObject.content = stickyHeader + message.content;
    if (message.channelId === '747426244773281884') messageObject.components.push(new ActionRowBuilder().addComponents(buttons.getArtistRole));
    // else if (message.channelId === '1073408805666299974') messageObject.components.push(new ActionRowBuilder().addComponents(buttons.getModderRole));
    message.channel.send(messageObject).then((stickyMessage) => {
        stickyMessages.set(stickyMessage.channelId, stickyMessage.id);  // update map with message id
        message.channel.messages.delete(messageId);  // delete original message
        // add to database
        pgClient.query(`INSERT INTO sticky_messages VALUES ( $1, $2 ) ;`, [stickyMessage.channelId, stickyMessage.id]).catch(err => console.error(err.stack));
    })
    .catch(err => console.error(err.stack));
    await interaction.reply({content: "Successfully sticked message.", ephemeral: true});
}

async function unstick(interaction) {
    let channel = abClient.channels.cache.get(interaction.channelId);
    channel.messages.delete(stickyMessages.get(interaction.channelId));  // delete stick message
    stickyMessages.delete(interaction.channelId);  // update map
    // remove from database
    pgClient.query(`DELETE FROM sticky_messages WHERE channel_id = $1 ;`, [interaction.channelId]);
    await interaction.reply({content: "Successfully unsticked message.", ephemeral: true});
}

async function anon(interaction) {
    let messageContent = interaction.options.getString('message');
    if (anonUsers.has(interaction.user.id) && interaction.createdTimestamp - anonUsers.get(interaction.user.id) < 5 * 60 * 1000) {
        console.log(`${interaction.user.tag} tried to send anonymously: ${messageContent}`);
        let remainingTime = 5 * 60 - Math.trunc(interaction.createdTimestamp / 1000 - anonUsers.get(interaction.user.id) / 1000);
        await interaction.reply({content: `You must wait ${remainingTime} seconds before doing this again.`, ephemeral: true});
        return;
    }
    console.log(`${interaction.user.tag} sent anonymously: ${messageContent}`);
    interaction.channel.send(messageContent).then(message => {
        anonMessages.set(message.id, interaction.user.id);
        anonUsers.set(interaction.user.id, message.createdTimestamp);
    });
    await interaction.reply({content: "Sent anonymous message.", ephemeral: true});
}

abClient.on(Events.ClientReady, async () =>
{
    console.log(`Logged in as ${abClient.user.username}`);
    abClient.user.setPresence({activities: [{name: 'League of Legends'}], status: 'online'});
});

abClient.on(Events.InteractionCreate, async (interaction) => {
    // console.log(interaction);
    let interactionHandler = null;
    if (interaction.isChatInputCommand()) {
        interactionHandler = commandsMap.get(interaction.commandName);
    }
    else if (interaction.isButton()) {
        interactionHandler = buttonsMap.get(interaction.customId);
    }    
    if (!interactionHandler) {
        console.error(`No interaction handler found:\n${interaction}`);
        return;
    }
    try {
        await interactionHandler(interaction).catch(err => console.error(err.stack));
    }
    catch (error) {
        console.error(error);
        await interaction.reply({content: 'There was an error during execution.', ephemeral: true});
    }
});

abClient.on(Events.MessageCreate, async (message) =>
{
    if(message.author.bot || message.webhookId) return;

    // DMs

    if(!message.guild)
    {
        console.log(`${message.author.tag}: ${message.content}`);
        try {
            let contents = message.content.trim();
            let debugChannel = abClient.channels.cache.get(debugChannelId);
            if(!debugChannel) return console.log("Failed to find channel");
            // debugChannel.send(`${message.author.tag}: ${message.content}`);
            formatPrompt(message).then(prompt => talk(prompt)).then((response) => message.reply(response)).catch(err => message.reply('<:rengar_confusion:1115059377297178696>'));
            // if (/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/.test(contents)) response = await verifyUser(debugChannel, contents.toLowerCase(), message.author.id, message.author.tag);
            // else if (!isNaN(contents)) response = await registerVote(debugChannel, message.author.id, message.author.tag, contents);
            // else if (contents.toLowerCase() === "use credit") response = await useCredit(message.author.id, message.author.tag);
            // else if (contents.toLowerCase() === "check credit") response = await checkCredit(message.author.id);
            // abClient.users.fetch(message.author.id, false).then((user) => {
            //     user.send(response);
            // }); // TODO improve this
        }
        catch (err)
        {
            console.error(err.stack);
        }
        return;
    }


    // server messages

    // if(message.guild && message.channel.id == debugChannelId) console.log(message)  // debug

    if (message.channelId == '747784406801842196') {  // event-submissions
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
        message.fetchReference().then(replyMessage => doMessageVote(replyMessage, message.author.id, message.content));
    }

    // sticky message
    if (stickyMessages.has(message.channelId) && !stickyLock.has(message.channelId))
    {
        stickyLock.add(message.channelId)
        message.channel.messages.fetch(stickyMessages.get(message.channelId)).then(stickyMessage => {
            stickyMessage.delete().catch(err => console.error(err.stack));
            message.channel.send({
                content: stickyMessage.content,
                embeds: stickyMessage.embeds,
                components: stickyMessage.components,
                attachments: stickyMessage.attachments,
                stickers: stickyMessage.stickers,
            })
            .then(stickyMessage => {
                // if (message.channelId === '747426244773281884' || message.channelId === '1073408805666299974') stickyMessage.react('<:unbenched:801499706625622046>');
                stickyMessages.set(message.channelId, stickyMessage.id);
                pgClient.query(`UPDATE sticky_messages SET message_id = $1 WHERE channel_id = $2 ;`, [stickyMessage.id, message.channelId]).catch(err => console.error(err.stack));
            })  // update map and database with new message id
            .catch(err => console.error(err.stack))
            .finally(() => stickyLock.delete(message.channelId));
        }).catch(err => console.error(err.stack));
    }

    // talk    
    if (!protectedChannelIds.has(message.channelId) && message.mentions.has(abClient.user)) formatPrompt(message).then(prompt => talk(prompt)).then((response) => message.reply(response)).catch(err => message.reply('<:rengar_confusion:1115059377297178696>'));
});


abClient.on(Events.MessageReactionAdd, async (reaction, user) => {
    // console.log(reaction)  // debug
    if (user.id === abId) return;
    if (reaction.emoji.name === '⬇️' || reaction.emoji.name === '⬆️') {
        doMessageVote(reaction.message, user.id, reaction.emoji.name);
    }
    else if (reaction.emoji.name === 'bonk' && reaction.message.channelId === '747425672779006043' && reaction.count >= 5) {
        let member = reaction.message.member;
        if (member.id == abId) {
            let guild = abClient.guilds.cache.get(serverId);
            if (!guild) return;
            member = guild.members.cache.get(anonMessages.get(reaction.message.id));
        }
        if (!member) return;
        doVoteBonk(member, reaction.message.createdTimestamp);
    }
    else if (reaction.emoji.name === '🆓' && protectedChannelIds.has(reaction.message.channelId)) reaction.remove();
});
