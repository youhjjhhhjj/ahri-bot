'use strict';

const fs = require('fs');
const path = require('path');
var https = require('https');
var http = require('http');
var qs = require('querystring')

const { debugChannelId, protectedChannels, staffIds, vstaffIds, abClient, pgClient } = require('./globals.js');
const { doMessageVote, bonk } = require('./moderation.js');
const { receiveDonation, registerVote, verifyUser, embed, checkCredit, useCredit } = require('./campaign.js');

let _token = ""
try {
    // local login
    let { token } = require('./token.json');
    _token = token;
} catch (error) {
    // railway login
    _token = process.env.DISCORD_TOKEN;
}
abClient.login(_token)

pgClient
  .connect()
  .then(() => console.log('connected'))
  .catch(err => console.error('connection error', err.stack))

const stickMessages = new Map();  // channelId: [messageId, contents]
// CREATE TABLE StickyMessages ( channel_id VARCHAR(255) PRIMARY KEY, message_id VARCHAR(255) UNIQUE, message_content TEXT ) ;
// populate stick messages
pgClient.query(`SELECT * FROM StickyMessages`).then(data => {
    data.rows.forEach(row => {
        stickMessages.set(row['channelId'], [row['messageId'], row['messageContent']])
    })
}).catch(err => console.error(err.stack))

const PORT = process.env.PORT || 4000;

var campaign = -1;  // -1 if no campaign, 0 if vote campaign, > 0 if goal campaign (price)



http.createServer(async function(req, res) {
    try {
        receiveDonation(req, res, campaign)
    }
    catch (err)
    {
        console.error(err.stack)
        res.writeHead(500);
        res.end()
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
        let response = []    
        var req = https.request(options, (res) => {      
            if (res.statusCode < 200 || res.statusCode > 299) {
                // console.log(res)
                reject('<:rengar_confusion:1115059377297178696>')
                return
            }  
            res.on('data', (d) => {
                response.push(d)
            });
            res.on('end', (d) => {
                let reply = JSON.parse(Buffer.concat(response).toString().trim())['generations'][0]['text']
                // let length = Math.max(reply.lastIndexOf('.'), reply.lastIndexOf('?'), reply.lastIndexOf('!'))
                // if (length > -1) reply = reply.slice(0, length + 1)
                resolve(reply)
                return
            })
        });    
        
        req.on('error', (e) => {
            console.error(e);
            reject("Ahri Bot broke.")
        });    
        req.write(postData);
        req.end();
    });
}


abClient.on('ready', async () =>
{
    console.log(`Logged in as ${abClient.user.username}`);
    abClient.user.setPresence({ activities: [{ name: '!help' }], status: 'online' });
})

abClient.on('messageCreate', async (message) =>
{
    if(message.author.bot || message.webhookId) return;

    // DMs

    if(!message.guild)
    {
        console.log(`${message.author.tag}: ${message.content}`);
        try {
            let contents = message.content.trim()
            let debugChannel = abClient.channels.cache.get(debugChannelId);
            if(!debugChannel) return console.log("Failed to find channel")
            let response = "Unrecognized command."
            if (/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/.test(contents)) response = await verifyUser(debugChannel, contents.toLowerCase(), message.author.id, message.author.tag);
            else if (campaign == 0 && vote_options.includes(parseInt(contents))) response = await registerVote(debugChannel, message.author.id, message.author.tag, contents);
            else if (campaign > 0 && contents.toLowerCase() === "use credit") response = await useCredit(message.author.id, message.author.tag);
            else if (contents.toLowerCase() === "check credit") response = await checkCredit(message.author.id);
            abClient.users.fetch(message.author.id, false).then((user) => {
                user.send(response);
            });
            return;
        }
        catch (err)
        {
            console.error(err.stack)
        }
    }


    // server messages

    // if(message.guild && message.channel.id == debugChannelId) console.log(message)  // debug

    if (campaign > 0 && message.channelId == 747784406801842196) {  // commission-request
        if (!message.content || message.content.length < 1 || message.attachments.size < 1) {
            message.delete()
            return
        }
        else {
            message.react('🔼').then(() => message.react('🔽'))
        }
    }

    // message vote
    if (message.reference !== null && (message.content === '⬇️' || message.content === '⬆️')) {
        try {            
            message.fetchReference().then(fetched_message => doMessageVote(fetched_message, message.author.id, message.content))
        }
        catch (err)
        {
            console.error(`Failed to time out ${message.author.tag}`)
        }
    }

    // sticky message
    if (!message.content.startsWith("!stick") && !message.content.startsWith("!stickstop") && stickMessages.has(message.channelId))
    {
        message.channel.messages.delete(stickMessages.get(message.channelId)[0])
        message.channel.send(`__**Stickied Message:**__\n ${stickMessages.get(message.channelId)[1]}`)
        .then(sent_message => {
            stickMessages.get(message.channelId)[0] = sent_message.id            
            pgClient.query(`UPDATE StickyMessages SET message_id = $1 WHERE channel_id = $2 ;`, [sent_message.id, message.channelId])
        })  // update map and database with new message id
        .catch(console.error);
    }

    // talk    
    if (!protectedChannels.has(message.channelId) && message.mentions.has(abClient.user)) talk(`@${message.author.username}: ${message.cleanContent.trim()} \n @Ahri Bot: `).then((response) => message.reply(response)).catch((response) => message.reply(response))


    // commands

    if(!message.guild || !message.content.startsWith('!')) return;

    if(!staffIds.has(message.author.id)) return;

    let cmd = message.content.trim().replace(/  /g, ' ').substring(1).split(' ');

    let params = cmd.slice(1);
    cmd = cmd[0].toLowerCase();

    if(cmd == "test")
    {
        message.channel.send('👍');
    }

    if (cmd == "embed")
    {
        embed()
    }

    if (cmd == "querydb")
    {
        var query = params.join(" ");
        pgClient.query(query).then(async (result) => {
            console.log(result)
            let splitStuff = JSON.stringify(result.rows, null, 4).match(/(.|\r\n|\n){1,1998}/g); // just in case regex counts differently or discord is weird (or both)
            for (const chunk in splitStuff) {
                if (Object.hasOwnProperty.call(splitStuff, chunk)) {
                    const e = splitStuff[chunk];
                    await message.channel.send(e);
                }
            }            
        }).catch(err => {
            console.error(err.stack)
            message.channel.send("Query error")
        });
    }

    if (cmd == "stick")
    {
        // TODO add compatibility for existing sticky
        let messageContent = params.join(' ')
        message.channel.send(`__**Stickied Message:**__\n" ${messageContent}`)
        .then(message => stickMessages.set(message.channelId, [message.id, messageContent]))  // update map with message id
        .catch(console.error);
        message.channel.messages.delete(message.id)  // delete command message
        // add to database
        pgClient.query(`INSERT INTO StickyMessages VALUES ( $1, $2, $3 ) ;`, [message.channelId, message.id, messageContent]).catch(err => console.error(err.stack))
    }
    if (cmd == "stickstop" && stickMessages.has(message.channelId))
    {
        message.channel.messages.delete(stickMessages.get(message.channelId)[0])  // delete stick message
        stickMessages.delete(message.channelId)  // update map
        message.channel.messages.delete(message.id)  // delete command message
        // remove from database
        pgClient.query(`DELETE FROM StickyMessages WHERE channel_id = $1 ;`, [message.channelId]).catch(err => console.error(err.stack))
    }
    if (cmd == "endcampaign") campaign = -1
})


abClient.on("messageReactionAdd", async (reaction, user) => {
    // console.log(reaction)
    // if (reaction.message.channelId !== debugChannelId || reaction.emoji.name !== "⬇️") return  // debug
    if (reaction.emoji.name === '⬇️' || reaction.emoji.name === '⬆️') {
        do_message_vote(reaction.message, user.id, reaction.emoji.name)
    }
    else if (reaction.emoji.name === 'bonk' && reaction.message.channelId != '1139191006890299463' && reaction.count >= 5) {
        bonk(reaction.message)
    }
    else if (reaction.emoji.name === '🆓' && protectedChannels.has(reaction.message.channelId)) reaction.remove()
})
