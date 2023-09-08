'use strict';
const { Client, Intents } = require('discord.js');
const bot = new Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES, Intents.FLAGS.DIRECT_MESSAGES, Intents.FLAGS.GUILD_MESSAGE_REACTIONS], partials: ['CHANNEL'], allowedMentions: { parse: ['users'] } });
const fs = require('fs');
const path = require('path');
var https = require('https');
var http = require('http');
var qs = require('querystring')
const debugchid = '994038938035556444';
const serverid = '747424654615904337';

const pg = require('pg');
const _db = process.env.DATABASE_URL
const pg_client = new pg.Pool({
  connectionString: _db,
  ssl: {
    rejectUnauthorized: false
  }
});
pg_client
  .connect()
  .then(() => console.log('connected'))
  .catch(err => console.error('connection error', err.stack))
// CREATE TABLE Verification061423 ( email VARCHAR(255) PRIMARY KEY, username VARCHAR(255) UNIQUE, user_id VARCHAR(255) UNIQUE, vote INTEGER, amount NUMERIC(5, 2) DEFAULT 0 ) ;
// CREATE TABLE Verification071123 ( email VARCHAR(255) UNIQUE, username VARCHAR(255) UNIQUE, user_id VARCHAR(255) UNIQUE, amount NUMERIC(5, 2) DEFAULT 0 ) ;
const table_metadata = {
    name: "Verification080423",
    email: "email",
    username: "username",   
    user_id: "user_id",
    vote: "vote",
    amount: "amount"
}

const vote_options = []

const stick_messages = new Map();  // channelId: [messageId, contents]
// CREATE TABLE StickyMessages ( channel_id VARCHAR(255) PRIMARY KEY, message_id VARCHAR(255) UNIQUE, message_content TEXT ) ;
// populate stick messages
pg_client.query(`SELECT * FROM StickyMessages`).then(data => {
    data.rows.forEach(row => {
        stick_messages.set(row["channel_id"], [row["message_id"], row["message_content"]])
    })
}).catch(err => console.error(err.stack))

const user_timeouts = new Map();
const message_votes = new Map();  // message_id: {'⬇️': Set[str], '⬆️': Set[str]}
const user_bonks = new Map();

const staff_ids = new Set(["603962299895775252", "328629962162700289", "534061021304717312", "447070898868977665"])

var embed_message_id = null

const PORT = process.env.PORT || 4000;

var campaign = -1;  // -1 if no campaign, 0 if vote campaign, > 0 if goal campaign (price)

const donator_role = null

const protected_channels = new Set(["1113124813138051242", "822701232413474816", "747425931148132522", "747425887292620840", "748209748322811904", "1073408805666299974"])


http.createServer(async function(req, res) {
     try {
        if (campaign == -1 || req.method != "POST") {
            res.writeHead(400);
            res.end()
            return
        }
        let data = []
        req.on('data', (d) => {
            data.push(d)
        });
        req.on('end', async function(d) {
            data = JSON.parse(qs.unescape(Buffer.concat(data)).slice(5))
            let don_email = data.email.toLowerCase()
            let confirmation = `Received ${data.amount} from ${don_email}`
            console.log(confirmation);
            bot.channels.cache.get(debugchid).send(confirmation);
            let result = await pg_client.query(`SELECT * FROM ${table_metadata.name} WHERE ${table_metadata.email} = $1 ;`, [don_email])
            if (result.rowCount == 0) // first time donation
            {
                await pg_client.query(`INSERT INTO ${table_metadata.name} ( ${table_metadata.email}, ${table_metadata.amount} ) VALUES ( $1, $2 ) ;`, [don_email, data.amount])
                if (campaign > 0) {
                    embed()
                }
            }
            else
            {
                await pg_client.query(`UPDATE ${table_metadata.name} SET ${table_metadata.amount} = $1 WHERE ${table_metadata.email} = $2 ;`, [parseFloat(result.rows[0][table_metadata.amount]) + parseFloat(data.amount), don_email])
                if (campaign > 0 || (campaign == 0 && result.rows[0][table_metadata.vote] !== null)) {  // auto update embed
                    embed()
                }
            }
            res.writeHead(200);
            res.end()
        });
     }
     catch (err)
     {
         console.error(err.stack)
         res.writeHead(500);
         res.end()
     }    
}).listen(PORT); 


async function registerVote(cn, user_id, username, vote)
{
// cases
//  0: user_id does not exist - do nothing
//  1: user_id does exist - set vote
    try
    {
        let result = await pg_client.query(`SELECT * FROM ${table_metadata.name} WHERE ${table_metadata.user_id} = $1 ;`, [user_id])
        if (result.rowCount == 0) // user_id does not exist
        {
            cn.send(`${username} tried to vote, but wasn't in database`);
            return "You were not found in the database. Did you message me your email first? Contact staff for assistance."
        }
        else
        {
            await pg_client.query(`UPDATE ${table_metadata.name} SET ${table_metadata.vote} = $1 WHERE ${table_metadata.user_id} = $2 ;`, [vote, user_id])
            cn.send(`${username} voted for ${vote}`)
            embed()
            return "Vote successfully added."
        }
    }
    catch (err)
    {
        console.error(err.stack)
    }
    return "Something went wrong, contact staff for assistance."
}

async function verifyUser(cn, email, user_id, username)
{
    try
    {
        let result = await pg_client.query(`SELECT * FROM ${table_metadata.name} WHERE ${table_metadata.email} = $1 ;`, [email])
        // console.log(result)
        if(result.rowCount == 0 || (result.rows[0][table_metadata.user_id] !== null && result.rows[0][table_metadata.user_id] !== user_id)) // email does not exist or exists with different user_id
        {
            cn.send(`${username} tried to verify, but wasn't in database`);
            return "This email was not found in the database. Are you sure it's your ko-fi email? Contact staff for assistance."
        }
        else // email already exists
        {
            if (result.rows[0][table_metadata.user_id] !== null)
            {
                cn.send(`${username} tried to verify with existing email ${email}`);
                return "You have already been verified."
            }
            else
            {
                await pg_client.query(`UPDATE ${table_metadata.name} SET ${table_metadata.user_id} = $1, ${table_metadata.username} = $2 WHERE ${table_metadata.email} = $3 ;`, [user_id, username, email])
                cn.send(`${username} verified successfully with email ${email}`);
                assign_donator(user_id)

                return (campaign == 0) ? "Successfully verified, now cast your vote." : "Successfully verified.";
            }
        }
    }
    catch (err)
    {
        console.error(err.stack)
        cn.send(`An unknown error occured while trying to verify ${username} with email ${email}`);
        return 'An unknown error occured, please try again later'
    }
}

async function assign_donator(user_id, cool = true) {
    try {
        let guild = bot.guilds.cache.get(serverid);
    
        let member = await guild.members.fetch(user_id);
        
        if (cool === true) member.roles.add(guild.roles.cache.find(r => r.name == 'Cool'));
        member.roles.add(guild.roles.cache.find(r => r.name == donator_role));
    }
    catch (err)
    {
        console.error(err.stack)
    }
}

async function create_embed_vote() {
    let fields = [
    ];
    let result = await pg_client.query(`SELECT vote, SUM(amount) AS vote_amount, CAST(SUM(amount) AS FLOAT) / MAX(total) AS vote_percent FROM ${table_metadata.name} CROSS JOIN (SELECT SUM(amount) AS total FROM ${table_metadata.name} WHERE ${table_metadata.vote} IS NOT NULL) AS Total GROUP BY vote, total ORDER BY vote`)
    for (let i = 0; i < result.rowCount; i++)
    {
        if (vote_options.includes(parseInt(result.rows[i][table_metadata.vote])))
        {
            fields[parseInt(result.rows[i][table_metadata.vote]) - 1]["name"] = fields[parseInt(result.rows[i][table_metadata.vote]) - 1]["name"].slice(0, -8) + parseInt(result.rows[i]["vote_percent"] * 100 + 0.5) + "% / $" + result.rows[i]["vote_amount"] + ")"
            fields[parseInt(result.rows[i][table_metadata.vote]) - 1]["value"] = "▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓".slice(0, parseInt(result.rows[i]["vote_percent"] * 20 + 0.5)) + "░░░░░░░░░░░░░░░░░░░░".slice(parseInt(result.rows[i]["vote_percent"] * 20 + 0.5));
        }
    }
    return { "embeds": [
        {
            "type": "rich",
            "title": ``,
            "description": `Follow the instructions above to participate in the event.`,
            "color": 0x1eff00,
            "fields": fields,
            "image": {
                // "url": ``,
                "height": 0,
                "width": 0
            }
        }]}
}

async function create_embed_campaign() {
    let result = await pg_client.query(`SELECT SUM(amount) AS total FROM ${table_metadata.name}`)
    let total = result.rows[0]["total"] || 0
    return { "embeds": [
        {
            "type": "rich",
            "title": ``,
            "description": `Follow the instructions above to participate in the event.`,
            "color": 0x1eff00,
            "fields": [{"name": ` $${total} out of $${campaign}`, "value": "▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓".slice(0, parseInt(total / campaign * 20 + 0.5)) + "░░░░░░░░░░░░░░░░░░░░".slice(parseInt(total / campaign * 20 + 0.5))}],
            "image": {
                // "url": ``,
                "height": 0,
                "width": 0
            }
        }]}
}

async function embed() {
    let embed_message = "Something broke :("
    try {
        let campaign_channel = bot.channels.cache.get("1113124813138051242")
        if (campaign == 0) embed_message = await create_embed_vote()
        else if (campaign > 0) embed_message = await create_embed_campaign()
        if (embed_message_id !== null) campaign_channel.messages.fetch(embed_message_id).then(message => message.edit(embed_message))
        else campaign_channel.send(embed_message).then((embed) => embed_message_id = embed.id)
    }
    catch (err)
    {
        console.error(err.stack)
    }
}

async function checkCredit(user_id) {
    let result = await pg_client.query(`SELECT * FROM Credit WHERE ${table_metadata.user_id} = $1 ;`, [user_id])
    if (result.rowCount == 0) return "You have no credit balance."
    return `Your credit balance is $${result.rows[0]["amount"]}.`
}

async function useCredit(user_id, username) {
    let result = await pg_client.query(`SELECT * FROM Credit WHERE ${table_metadata.user_id} = $1 ;`, [user_id])
    if (result.rowCount == 0 || result.rows[0]["amount"] == 0) return "You have no credit balance."
    let amount = result.rows[0]["amount"]
    await pg_client.query(`UPDATE Credit SET ${table_metadata.amount} = 0 WHERE ${table_metadata.user_id} = $1 ;`, [user_id])
    result = await pg_client.query(`UPDATE ${table_metadata.name} SET amount = amount + $2 WHERE ${table_metadata.user_id} = $1`, [user_id, amount])
    if (result.rowCount == 0) {
        await pg_client.query(`INSERT INTO ${table_metadata.name} ( ${table_metadata.user_id}, ${table_metadata.username}, ${table_metadata.amount} ) VALUES ( $1, $2, $3 ) ;`, [user_id, username, amount])
    }
    let confirmation = `${username} used $${amount} of credit`
    console.log(confirmation);
    bot.channels.cache.get(debugchid).send(confirmation);
    assign_donator(user_id, false)
    embed()
    return `You have successfully applied $${amount} of credit.`
}

async function do_message_vote(message, voter_id, vote) {
    if (user_timeouts.has(message.author.id) && user_timeouts.get(message.author.id) >= message.createdTimestamp) return
    if (!message_votes.has(message.id)) message_votes.set(message.id, {'⬇️': new Set(), '⬆️': new Set()})
    let message_vote = message_votes.get(message.id)
    message_vote[vote].add(voter_id)
    if (message_vote['⬇️'].size - message_vote['⬆️'].size >= 5) {
        let num_mins = message.createdTimestamp - user_timeouts.get(message.author.id) < 1000 * 60 * 60 ? 30 : 10  // if less than an hour from previous timeout, set 30 mins instead of 10
        user_timeouts.set(message.author.id, message.createdTimestamp)
        if (staff_ids.has(message.author.id)) message.reply("Shut up mod.");
        else if (message.webhookId) message.reply("Shut up ... server?");
        else if (message.author.bot) message.reply("Shut up bot.");
        else {
            console.log(`${message.author.tag} timed out`)
            message.guild.members.fetch(message.author.id).then((member) => {
                member.timeout(1000 * 60 * num_mins)
                .then(message.reply("People didn't like this, you have been timed out for " + num_mins + " minutes."))
                .then(setTimeout(() => member.timeout(null).catch(), 1000 * 60 * num_mins))
                .catch(err => console.error('connection error', err.stack))
            })
            .catch(err => message.reply("Something broke while trying to make you shut up..."))
        }
    }
}

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
    if (message.mentions.has(bot.user)) talk(`@${message.author.username}: ${message.cleanContent.trim()} \n @Ahri Bot: `).then((response) => message.reply(response)).catch((response) => message.reply(response))


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
        console.log(user_bonks)
        if (user_bonks.has(reaction.message.author.id) && user_bonks.get(reaction.message.author.id) >= reaction.message.createdTimestamp) return
        user_bonks.set(reaction.message.author.id, reaction.message.createdTimestamp)
        reaction.message.member.roles.add("1142589211392872620")
        setTimeout(async () => {
            let guild = bot.guilds.cache.get(serverid);
            let member = await guild.members.fetch(reaction.message.author.id)
            member.roles.remove("1142589211392872620").catch(err => console.error(err.stack))
        }, 1000 * 60 * 60)
        bot.channels.cache.get("1139191006890299463").send(`${reaction.message.author} has been bonked.`);
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
