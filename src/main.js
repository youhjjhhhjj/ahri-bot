'use strict';

const fs = require('fs');
const path = require('path');
var https = require('https');
var http = require('http');
var qs = require('querystring')

pg_client
  .connect()
  .then(() => console.log('connected'))
  .catch(err => console.error('connection error', err.stack))

const stick_messages = new Map();  // channelId: [messageId, contents]
// CREATE TABLE StickyMessages ( channel_id VARCHAR(255) PRIMARY KEY, message_id VARCHAR(255) UNIQUE, message_content TEXT ) ;
// populate stick messages
pg_client.query(`SELECT * FROM StickyMessages`).then(data => {
    data.rows.forEach(row => {
        stick_messages.set(row["channel_id"], [row["message_id"], row["message_content"]])
    })
}).catch(err => console.error(err.stack))

const staff_ids = new Set(["603962299895775252", "328629962162700289", "534061021304717312", "447070898868977665"])

const PORT = process.env.PORT || 4000;

var campaign = -1;  // -1 if no campaign, 0 if vote campaign, > 0 if goal campaign (price)

const donator_role = null

const protected_channels = new Set(["1113124813138051242", "822701232413474816", "747425931148132522", "747425887292620840", "748209748322811904", "1073408805666299974"])


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
            "prompt": message,
            "max_tokens": 200
        });    
        var options = {
        hostname: "api.cohere.ai",
        path: "/v1/generate",
        method: 'POST',
        headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'Authorization': 'Bearer RQFHrtyLOClxW0SHEKYokn6UBUBlefpeeG7MAzqm'
            }
        };    
        let response = []    
        var req = https.request(options, (res) => {      
            if (res.statusCode < 200 || res.statusCode > 299) {
                // console.log(res)
                reject("<:rengar_confusion:1115059377297178696>")
                return
            }  
            res.on('data', (d) => {
                response.push(d)
            });
            res.on('end', (d) => {
                let reply = JSON.parse(Buffer.concat(response).toString().trim())["generations"][0]["text"]
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


bot.on("ready", async () =>
{
    console.log(`Logged in as ${bot.user.username}`);
    bot.user.setPresence({ activities: [{ name: '!help' }], status: 'online' });
})

bot.on("messageCreate", async (message) =>
{
    if(message.author.bot || message.webhookId) return;

    // DMs

    if(!message.guild)
    {
        console.log(message.author.tag + ": " + message.content);
        try {
            let contents = message.content.trim()
            let cn = bot.channels.cache.get(debugchid);
            if(!cn) return console.log('failed to find channel')
            let response = "Unrecognized command."
            if (/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/.test(contents)) response = await verifyUser(cn, contents.toLowerCase(), message.author.id, message.author.tag);
            else if (campaign == 0 && vote_options.includes(parseInt(contents))) response = await registerVote(cn, message.author.id, message.author.tag, contents);
            else if (campaign > 0 && contents.toLowerCase() === "use credit") response = await useCredit(message.author.id, message.author.tag);
            else if (contents.toLowerCase() === "check credit") response = await checkCredit(message.author.id);
            bot.users.fetch(message.author.id, false).then((user) => {
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

    // if(message.guild && message.channel.id == debugchid) console.log(message)  // debug

    // record who posts to community-skins, exclude StickyBot
    if (message.channelId == "1073408805666299974" && message.author.id != "628400349979344919") bot.channels.cache.get(debugchid).send(`${message.author.tag} posted in #community-skins`)

    if (message.channelId == 747784406801842196) {  // commission-request
        if (!message.content || message.content.length < 1 || message.attachments.size < 1) {
            message.delete()
            return
        }
        else {
            message.react("🔼").then(() => message.react("🔽"))
        }
    }

    // message vote
    if (message.reference !== null && (message.content === '⬇️' || message.content === '⬆️')) {
        try {            
            message.fetchReference().then(fetched_message => do_message_vote(fetched_message, message.author.id, message.content))
        }
        catch (err)
        {
            console.error("Failed to time out " + message.author.tag)
        }
    }

    // sticky message
    if (!message.content.startsWith("!stick") && !message.content.startsWith("!stickstop") && stick_messages.has(message.channelId))
    {
        message.channel.messages.delete(stick_messages.get(message.channelId)[0])
        message.channel.send("__**Stickied Message:**__\n" + stick_messages.get(message.channelId)[1])
        .then(sent_message => {
            stick_messages.get(message.channelId)[0] = sent_message.id            
            pg_client.query(`UPDATE StickyMessages SET message_id = $1 WHERE channel_id = $2 ;`, [sent_message.id, message.channelId])
        })  // update map and database with new message id
        .catch(console.error);
    }

    // talk    
    if (!protected_channels.has(message.channelId) && message.mentions.has(bot.user)) talk(`@${message.author.username}: ${message.cleanContent.trim()} \n @Ahri Bot: `).then((response) => message.reply(response)).catch((response) => message.reply(response))


    // commands

    if(!message.guild || !message.content.startsWith("!")) return;

    if(!staff_ids.has(message.author.id)) return;

    let cmd = message.content.trim().replace(/  /g, ' ').substring(1).split(" ");

    let param = cmd.slice(1);
    cmd = cmd[0].toLowerCase();

    if(cmd == "test")
    {
        message.channel.send("👍");
    }

    if (cmd == "embed")
    {
        embed()
    }

    if (cmd == "querydb")
    {
        var query = param.join(" ");
        pg_client.query(query).then(async (result) => {
            console.log(result)
            let splitstuff = JSON.stringify(result.rows, null, 4).match(/(.|\r\n|\n){1,1998}/g); // just in case regex counts differently or discord is retarded (or both)
            for (const chunk in splitstuff) {
                if (Object.hasOwnProperty.call(splitstuff, chunk)) {
                    const e = splitstuff[chunk];
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
        let message_content = param.join(" ")
        message.channel.send("__**Stickied Message:**__\n" + message_content)
        .then(message => stick_messages.set(message.channelId, [message.id, message_content]))  // update map with message id
        .catch(console.error);
        message.channel.messages.delete(message.id)  // delete command message
        // add to database
        pg_client.query(`INSERT INTO StickyMessages VALUES ( $1, $2, $3 ) ;`, [message.channelId, message.id, message_content]).catch(err => console.error(err.stack))
    }
    if (cmd == "stickstop" && stick_messages.has(message.channelId))
    {
        message.channel.messages.delete(stick_messages.get(message.channelId)[0])  // delete stick message
        stick_messages.delete(message.channelId)  // update map
        message.channel.messages.delete(message.id)  // delete command message
        // remove from database
        pg_client.query(`DELETE FROM StickyMessages WHERE channel_id = $1 ;`, [message.channelId]).catch(err => console.error(err.stack))
    }
    if (cmd == "setembed") embed_message_id = param[0]

    if (cmd == "endcampaign") campaign = -1
})


bot.on("messageReactionAdd", async (reaction, user) => {
    // console.log(reaction)
    // if (reaction.message.channelId !== debugchid || reaction.emoji.name !== "⬇️") return  // debug
    if (reaction.emoji.name === '⬇️' || reaction.emoji.name === '⬆️') {
        do_message_vote(reaction.message, user.id, reaction.emoji.name)
    }
    // else if (reaction.message.channelId == '747426199780982791' && reaction.emoji.name === '👍' && staff_ids.has(user.id)) {  // meme review
    //     assign_donator(reaction.message.author.id, false)
    // }
    else if (reaction.emoji.name === "bonk" && reaction.message.channelId != "1139191006890299463" && reaction.count >= 5) {
        bonk(reaction.message)
    }
    else if (reaction.emoji.name === '🆓' && protected_channels.has(reaction.message.channelId)) reaction.remove()
})


let _token = ""

try {
    // local login
    let { token } = require('./token.json');
    _token = token;
} catch (error) {
    // railway login
    _token = process.env.DISCORD_TOKEN;
}

bot.login(_token)
