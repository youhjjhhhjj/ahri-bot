'use strict';
const { Client, Intents, MessageEmbed } = require('discord.js');
const bot = new Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES, Intents.FLAGS.DIRECT_MESSAGES, Intents.FLAGS.GUILD_MESSAGE_REACTIONS], partials: ['CHANNEL'] });
const fs = require('fs');
const path = require('path');
const debugchid = '994038938035556444';
const serverid = '747424654615904337';

// const express = require("express");
// const app = express();
// app.use(express.json());
// app.use(express.urlencoded({ extended: true }));

// const pg = require('pg');
// const _db = process.env.DATABASE_URL || "postgresql://postgres:N9r9INaxC3gmXp7HZjfj@containers-us-west-57.railway.app:6196/railway";
// const pg_client = new pg.Pool({
//   connectionString: _db,
//   ssl: {
//     rejectUnauthorized: false
//   }
// });
// pg_client
//   .connect()
//   .then(() => console.log('connected'))
//   .catch(err => console.error('connection error', err.stack))
// // CREATE TABLE Verification061423 ( email VARCHAR(255) PRIMARY KEY, username VARCHAR(255) UNIQUE, user_id VARCHAR(255) UNIQUE, vote INTEGER, amount NUMERIC(5, 2) DEFAULT 0 ) ;
// const table_metadata = {
//     name: "Verification061423",
//     email: "email",
//     username: "username",
//     user_id: "user_id",
//     vote: "vote",
//     amount: "amount"
// }

// const vote_options = [1, 2, 3, 4, 5, 6]

const stick_messages = new Map();  // channelId: [messageId, contents]

const user_timeouts = new Map();
const message_votes = new Map();  // message_id: {'⬇️': Set[str], '⬆️': Set[str]}

const staff_ids = new Set(["603962299895775252", "328629962162700289", "534061021304717312", "447070898868977665"])

var embed_message_id = null

const PORT = process.env.PORT || 4000;

// app.post( '/', async function(req, res) {
//     try {
//         // console.log(req.body.data)
//         let don_data = JSON.parse(req.body.data)
//         let don_email = don_data.email.toLowerCase()
//         let confirmation = `Received ${don_data.amount} from ${don_email}`
//         console.log(confirmation);
//         bot.channels.cache.get(debugchid).send(confirmation);
//         let result = await pg_client.query(`SELECT * FROM ${table_metadata.name} WHERE ${table_metadata.email} = $1 ;`, [don_email])
//         if (result.rows.length == 0) // first time donation
//         {
//             await pg_client.query(`INSERT INTO ${table_metadata.name} ( ${table_metadata.email}, ${table_metadata.amount} ) VALUES ( $1, $2 ) ;`, [don_email, don_data.amount])
//         }
//         else
//         {
//             await pg_client.query(`UPDATE ${table_metadata.name} SET ${table_metadata.amount} = $1 WHERE ${table_metadata.email} = $2 ;`, [parseFloat(result.rows[0][table_metadata.amount]) + parseFloat(don_data.amount), don_email])
//             if (result.rows[0][table_metadata.vote] !== null) {  // auto update embed
//                 let campaign_channel = bot.channels.cache.get("1113124813138051242")
//                 if (embed_message_id) {
//                     campaign_channel.messages.delete(embed_message_id)
//                 }
//                 embed(campaign_channel)
//             }
//         }
//         res.sendStatus(200);
//     }
//     catch (err)
//     {
//         console.error(err.stack)
//         res.sendStatus(400);
//     }
    
// } );

// async function registerVote(cn, user_id, username, vote)
// {
// // cases
// //  0: user_id does not exist - do nothing
// //  1: user_id does exist - set vote
//     try
//     {
//         let result = await pg_client.query(`SELECT * FROM ${table_metadata.name} WHERE ${table_metadata.user_id} = $1 ;`, [user_id])
//         if (result.rows.length == 0) // user_id does not exist
//         {
//             cn.send(`${username} tried to vote, but wasn't in database`);
//             return "You were not found in the database. Did you message me your email first? Contact staff for assistance."
//         }
//         else
//         {
//             await pg_client.query(`UPDATE ${table_metadata.name} SET ${table_metadata.vote} = $1 WHERE ${table_metadata.user_id} = $2 ;`, [vote, user_id])
//             cn.send(`${username} voted for ${vote}`)
//             // update embed
//             let campaign_channel = bot.channels.cache.get("1113124813138051242")
//             if (embed_message_id) {
//                 campaign_channel.messages.delete(embed_message_id)
//             }
//             embed(campaign_channel)
//             return "Vote successfully added."
//         }
//     }
//     catch (err)
//     {
//         console.error(err.stack)
//     }
//     return "Something went wrong, contact staff for assistance."
// }

// async function verifyUser(cn, email, user_id, username)
// {
//     try
//     {
//         let result = await pg_client.query(`SELECT * FROM ${table_metadata.name} WHERE ${table_metadata.email} = $1 ;`, [email])
//         // console.log(result)
//         if(result.rows.length == 0 || (result.rows[0][table_metadata.user_id] !== null && result.rows[0][table_metadata.user_id] !== user_id)) // email does not exist or exists with different user_id
//         {
//             cn.send(`${username} tried to verify, but wasn't in database`);
//             return "This email was not found in the database. Are you sure it's your ko-fi email? Contact staff for assistance."
//         }
//         else // email already exists
//         {
//             if (result.rows[0][table_metadata.user_id] !== null)
//             {
//                 cn.send(`${username} tried to verify with existing email ${email}`);
//                 return "You have already been verified."
//             }
//             else
//             {
//                 await pg_client.query(`UPDATE ${table_metadata.name} SET ${table_metadata.user_id} = $1, ${table_metadata.username} = $2 WHERE ${table_metadata.email} = $3 ;`, [user_id, username, email])
//                 cn.send(`${username} verified successfully with email ${email}`);
//                 // assign roles
//                 let guild = bot.guilds.cache.get(serverid);
//                 if (!guild) return cn.send("Failed to find guild");

//                 let member = await guild.members.fetch(user_id);
//                 if (!member) return cn.send("Failed to find member");
                
//                 let role1 = guild.roles.cache.find(r => r.name == 'Cool');
//                 let role2 = guild.roles.cache.find(r => r.name == 'Donator2');                
//                 if (!role1 || !role2) return cn.send("Failed to find role");

//                 member.roles.add(role1);
//                 member.roles.add(role2);

//                 return "Successfully verified, now cast your vote."
//             }
//         }
//     }
//     catch (err)
//     {
//         console.error(err.stack)
//         cn.send(`An unknown error occured while trying to verify ${username} with email ${email}`);
//         return 'An unknown error occured, please try again later'
//     }
// }

// async function embed(channel) {
//     let fields = [
//         {"name": "1: Rell (0% / $0)", "value": "░░░░░░░░░░░░░░░░░░░░"}, 
//         {"name": "2: Ashe (0% / $0)", "value": "░░░░░░░░░░░░░░░░░░░░"}, 
//         {"name": "3: Withered Rose Syndra (0% / $0)", "value": "░░░░░░░░░░░░░░░░░░░░"}, 
//         {"name": "4: Unbound Thresh (0% / $0)", "value": "░░░░░░░░░░░░░░░░░░░░"}, 
//         {"name": "5: Astronaut Poppy (0% / $0)", "value": "░░░░░░░░░░░░░░░░░░░░"}, 
//         {"name": "6: Miss Fortune (0% / $0)", "value": "░░░░░░░░░░░░░░░░░░░░"}, 
//     ];
//     pg_client.query(`SELECT vote, SUM(amount) AS vote_amount, CAST(SUM(amount) AS FLOAT) / MAX(total) AS vote_percent FROM ${table_metadata.name} CROSS JOIN (SELECT SUM(amount) AS total FROM ${table_metadata.name} WHERE ${table_metadata.vote} IS NOT NULL) AS Total GROUP BY vote, total ORDER BY vote`).then(async (result) => {
//         for (let i = 0; i < result.rows.length; i++)
//         {
//             if (vote_options.includes(parseInt(result.rows[i][table_metadata.vote])))
//             {
//                 fields[parseInt(result.rows[i][table_metadata.vote]) - 1]["name"] = fields[parseInt(result.rows[i][table_metadata.vote]) - 1]["name"].slice(0, -8) + parseInt(result.rows[i]["vote_percent"] * 100 + 0.5) + "% / $" + result.rows[i]["vote_amount"] + ")"
//                 fields[parseInt(result.rows[i][table_metadata.vote]) - 1]["value"] = "▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓".slice(0, parseInt(result.rows[i]["vote_percent"] * 20 + 0.5)) + "░░░░░░░░░░░░░░░░░░░░".slice(parseInt(result.rows[i]["vote_percent"] * 20 + 0.5));
//             }
//         }
//         channel.send({ "embeds": [
//             {
//                 "type": "rich",
//                 "title": `10k Members Skin Campaign #2`,
//                 "description": `Follow the instructions above to participate in the event.`,
//                 "color": 0x1eff00,
//                 "fields": fields,
//                 "image": {
//                   "url": `https://cdn.discordapp.com/attachments/839085704658681937/1118666337108107264/campaign061423.png`,
//                   "height": 0,
//                   "width": 0
//                 }
//             }
//             ]
//         }).then((embed) => embed_message_id = embed.id)
//     }).catch(err => {
//         console.error(err.stack)
//     });
// }

async function do_message_vote(message, voter_id, vote) {
    if (user_timeouts.has(message.author.id) && user_timeouts.get(message.author.id) >= message.createdTimestamp) return
    if (!message_votes.has(message.id)) message_votes.set(message.id, {'⬇️': new Set(), '⬆️': new Set()})
    let message_vote = message_votes.get(message.id)
    message_vote[vote].add(voter_id)
    if (message_vote['⬇️'].size - message_vote['⬆️'].size >= 5) {
        user_timeouts.set(message.author.id, message.createdTimestamp)
        if (staff_ids.has(message.author.id)) message.reply("Shut up mod.");
        else if (message.webhookId) message.reply("Shut up ... server?");
        else if (message.author.bot) message.reply("Shut up bot.");
        else {
            console.log(`${message.author.tag} timed out`)
            message.guild.members.fetch(message.author.id).then((member) => {
                member.timeout(1000 * 60 * 10)
                .then(message.reply("People didn't like this, you have been timed out for 10 minutes."))
                .then(setTimeout(() => member.timeout(null), 1000 * 60 * 10))
                .catch(err => console.error('connection error', err.stack))
            })
            .catch(err => console.error('connection error', err.stack))
        }
    }
}


bot.on("ready", async () =>
{
    console.log(`Logged in as ${bot.user.username}`);
    bot.user.setPresence({ activities: [{ name: 'https://nsfwskins.github.io/' }], status: 'dnd' });
})

bot.on("messageCreate", async (message) =>
{
    if(message.author.bot || message.webhookId) return;

    // DMs

    if(!message.guild)
    {
        console.log(message.author.tag + ": " + message.content);
        return
        try {
            let contents = message.content.trim()
            let cn = bot.channels.cache.get(debugchid);
            if(!cn) return console.log('failed to find channel')
            if (/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/.test(contents))
            {
                let verification_message = await verifyUser(cn, contents.toLowerCase(), message.author.id, message.author.tag);
                bot.users.fetch(message.author.id, false).then((user) => {
                    user.send(verification_message);
                });
            }
            else if (vote_options.includes(parseInt(contents)))
            {
                let vote_message = await registerVote(cn, message.author.id, message.author.tag, contents);
                bot.users.fetch(message.author.id, false).then((user) => {
                    user.send(vote_message);
                });
            }
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

    // if (message.channelId == 747784406801842196) {  // commission-request
    //     if (!message.content || message.content.length < 1 || message.attachments.size < 1) {
    //         message.delete()
    //         return
    //     }
    //     else {
    //         message.react("🔼").then(() => message.react("🔽"))//.then(submissions.set(message.id, 0))
    //     }
    // }

    // message downvote
    if (message.reference !== null && (message.content === '⬇️' || message.content === '⬆️')) {
        message.fetchReference().then(fetched_message => do_message_vote(fetched_message, message.author.id, message.content))
    }

    // sticky message
    if (!message.content.startsWith("!stick") && !message.content.startsWith("!stickstop") && stick_messages.has(message.channelId))
    {
        message.channel.messages.delete(stick_messages.get(message.channelId)[0])
        message.channel.send("__**Stickied Message:**__\n" + stick_messages.get(message.channelId)[1])
        .then(sent_message => stick_messages.get(message.channelId)[0] = sent_message.id)  // update map with new message id
        .catch(console.error);
    }


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
        embed(bot.channels.cache.get("1113124813138051242"))
    }

    // if (cmd == "querydb")
    // {
    //     var query = param.join(" ");
    //     pg_client.query(query).then(async (result) => {
    //         console.log(result)
    //         let splitstuff = JSON.stringify(result.rows, null, 4).match(/(.|\r\n|\n){1,1998}/g); // just in case regex counts differently or discord is retarded (or both)
    //         for (const chunk in splitstuff) {
    //             if (Object.hasOwnProperty.call(splitstuff, chunk)) {
    //                 const e = splitstuff[chunk];
    //                 await message.channel.send(e);
    //             }
    //         }            
    //     }).catch(err => {
    //         console.error(err.stack)
    //         message.channel.send("Query error")
    //     });
    // }

    if (cmd == "stick")
    {
        let message_content = param.join(" ")
        message.channel.send("__**Stickied Message:**__\n" + message_content)
        .then(message => stick_messages.set(message.channelId, [message.id, message_content]))  // update map with message id
        .catch(console.error);
        message.channel.messages.delete(message.id)  // delete command message
    }
    if (cmd == "stickstop" && stick_messages.has(message.channelId))
    {
        message.channel.messages.delete(stick_messages.get(message.channelId)[0])  // delete stick message
        stick_messages.delete(message.channelId)  // update map
        message.channel.messages.delete(message.id)  // delete command message
    }
    if (cmd == "stickadd")
    {
        try {
            let channel_id = param[0]
            let message_id = param[1]
            let message_content = param.slice(2).join(" ")
            stick_messages.set(channel_id, [message_id, message_content])
            console.log(stick_messages)
        }
        catch (err) {
            console.error(err.stack)
        }
    }
    // if (cmd == "purge_donators")
    // {
    //     try {
    //         let role = message.guild.roles.cache.find(r => r.name == 'Donator');  
    //         role.members.forEach((member, i) => { // Looping through the members of role.
    //             setTimeout(() => {
    //                 member.roles.remove(role); // Removing the role.
    //             }, i * 100);
    //         });
    //     }
    //     catch (err) {
    //         console.error(err.stack)
    //     }
    // }
})


bot.on("messageReactionAdd", async (reaction, user) => {
    // console.log(reaction)
    // if (reaction.message.channelId !== debugchid || reaction.emoji.name !== "⬇️") return  // debug
    if (reaction.emoji.name === '⬇️' || reaction.emoji.name === '⬆️') {
        do_message_vote(reaction.message, user.id, reaction.emoji.name)
    }
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
// app.listen( PORT, () => console.log( "Node.js server started on port ", PORT ) );
