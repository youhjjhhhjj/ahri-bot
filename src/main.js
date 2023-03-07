'use strict';
const { Client, Intents, MessageEmbed } = require('discord.js');
const bot = new Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES, Intents.FLAGS.DIRECT_MESSAGES], partials: ["CHANNEL"] });
const fs = require('fs');
const path = require('path');
const debugchid = '994038938035556444';
const serverid = '747424654615904337';
const pg = require('pg');
const _db = process.env.DATABASE_URL || "postgresql://postgres:N9r9INaxC3gmXp7HZjfj@containers-us-west-57.railway.app:6196/railway";
const pg_client = new pg.Client({
  connectionString: _db,
  ssl: {
    rejectUnauthorized: false
  }
});
pg_client
  .connect()
  .then(() => console.log('connected'))
  .catch(err => console.error('connection error', err.stack))
// CREATE TABLE Verification030723 (email VARCHAR(255) PRIMARY KEY, username VARCHAR(255) UNIQUE, verified BOOLEAN NOT NULL DEFAULT FALSE, vote INTEGER, amount INTEGER DEFAULT 0 ) ;
const table_metadata = {
    name: "Verification030723",
    email: "email",
    username: "username",
    verified: "verified",
    vote: "vote",
    amount: "amount"
}
const vote_options = [1, 2, 3, 4, 5, 6, 7]

async function addNewEmail(email, amount)
// cases
//  0: email didn't exist - added email
//  1: email existed, username not null, not verified - verified
//  2: email existed - add amount to user row
//  -1: error
{
    try
    {
        let result = await pg_client.query(`SELECT * FROM ${table_metadata.name} WHERE ${table_metadata.email} = $1 ;`, [email])
        // console.log(result)
        if(result.rows.length == 0) // email does not exist
        {            
            try {
                await pg_client.query(`INSERT INTO ${table_metadata.name} ( ${table_metadata.email}, ${table_metadata.username}, ${table_metadata.amount} ) VALUES ( $1, $2, $3) ;`, [email, null, amount])
                return 0
            }
            catch (err)
            {
                console.error(err.stack)
            }
        }
        else // email already exists
        {
            let cn = bot.channels.cache.get(debugchid);
            if(!cn) return console.log('failed to find channel')
            
            if (result.rows[0][table_metadata.verified] == false)
            {
                if (result.rows[0][table_metadata.username] !== null)
                {
                    await pg_client.query(`UPDATE ${table_metadata.name} SET ${table_metadata.verified} = $1, ${table_metadata.amount} = $2 WHERE ${table_metadata.email} = $3 ;`, [true, amount, email])
                    
                    let guild = bot.guilds.cache.get(serverid);

                    if (!guild) return cn.send("Failed to find guild");
        
                    let user = bot.users.cache.find(u => {
        
                        // console.log(u.tag, result.rows[0][table_metadata.username]);
                        return u.tag === result.rows[0][table_metadata.username];
                    });
        
                    if (!user) return cn.send("Failed to find user");
        
                    let member = await guild.members.fetch(user.id);
        
                    if (!member) return cn.send("Failed to find member");
                    
                    let role1 = guild.roles.cache.find(r => r.name == '.');
                    let role2 = guild.roles.cache.find(r => r.name == 'Donator');
                    
                    if (!role1) return cn.send("Failed to find role");
                    if (!role2) return cn.send("Failed to find role");
        
                    member.roles.add(role1);
                    member.roles.add(role2);

                    return 1
                }
            }
            else
            {
                await pg_client.query(`UPDATE ${table_metadata.name} SET ${table_metadata.amount} = $1 WHERE ${table_metadata.email} = $2 ;`, [result.rows[0][table_metadata.amount] + amount, email])
                return 2
            }
        }
    }
    catch (err)
    {
        console.error(err.stack)
    }
    return -1
}

async function verifyEmail(email, username)
// cases
//  0: email didn't exist - added email and username
//  1: email existed, username not null, not verified - do nothing
//  2: email existed and username is null - verified
//  3: email existed and verified - do nothing
//  -1: error
{
    try
    {
        let result = await pg_client.query(`SELECT * FROM ${table_metadata.name} WHERE ${table_metadata.email} = $1 ;`, [email])
        // console.log(result)
        if(result.rows.length == 0) // email does not exist
        {            
            try {
                await pg_client.query(`INSERT INTO ${table_metadata.name} ( ${table_metadata.email}, ${table_metadata.username} ) VALUES ( $1, $2 ) ;`, [email, username])
                return 0
            }
            catch (err)
            {
                console.error(err.stack)
            }
        }
        else // email already exists
        {
            if (result.rows[0][table_metadata.verified] == false)
            {
                if (result.rows[0][table_metadata.username] !== null)
                {
                    return 1
                }
                else
                {
                    await pg_client.query(`UPDATE ${table_metadata.name} SET ${table_metadata.username} = $1, ${table_metadata.verified} = $2 WHERE ${table_metadata.email} = $3 ;`, [username, true, email])
                    return 2
                }
            }
            else
            {
                return 3
            }
        }
    }
    catch (err)
    {
        console.error(err.stack)
    }
    return -1
}

async function registerVote(cn, username, vote)
{
// cases
//  0: username does not exist - do nothing
//  1: username does exist - set vote
    try
    {
        let result = await pg_client.query(`SELECT * FROM ${table_metadata.name} WHERE ${table_metadata.username} = $1 ;`, [username.toLowerCase()])
        if (result.rows.length == 0) // username does not exist
        {
            cn.send(`${username} tried to vote, but wasn't in database`);
            return "You were not found in the database, contact staff if you believe this is an error"
        }
        else
        {
            await pg_client.query(`UPDATE ${table_metadata.name} SET ${table_metadata.vote} = $1 WHERE ${table_metadata.username} = $2 ;`, [vote, username.toLowerCase()])
            cn.send(`${username} voted for ${vote}`)
            return "Vote received"
        }
    }
    catch (err)
    {
        console.error(err.stack)
    }
    return -1
}

async function tryVerification(cn, email, username)
{
    let result = await verifyEmail(email.toLowerCase(), username.toLowerCase());
    switch (result)
    {
        case 0:
            cn.send(`${username} added to database with email ${email}`);
            return 'Verification request received, you will be verified within 24 hours if valid'
        case 1:
            cn.send(`${username} tried to verify with existing unverified email ${email}`);
            return 'Verification request received, you will be verified within 24 hours if valid'
        case 2:
            let guild = bot.guilds.cache.get(serverid);

            if (!guild) return cn.send("Failed to find guild");

            let user = bot.users.cache.find(u => {

                console.log(u.tag, username);
                return u.tag === username;
            });

            if (!user) return cn.send("Failed to find user");

            let member = await guild.members.fetch(user.id);

            if (!member) return cn.send("Failed to find member");
            
            let role1 = guild.roles.cache.find(r => r.name == '.');
            let role2 = guild.roles.cache.find(r => r.name == 'Donator');
            
            if (!role1) return cn.send("Failed to find role");
            if (!role2) return cn.send("Failed to find role");

            member.roles.add(role1);
            member.roles.add(role2);

            cn.send(`${username} verified successfully with email ${email}`);

            return 'Successfully verified'
        case 3:
            cn.send(`${username} attempted to verify with already verified email ${email}`);
            return 'You have already been verified'
        default:
            cn.send(`An unknown error occured while trying to verify ${username} with email ${email}`);
            return 'An unknown error occured, please contact staff'
    }
}


bot.on("ready", async () =>
{
    console.log(`Logged in as ${bot.user.username}`);
    bot.user.setPresence({ activities: [{ name: 'https://nsfwskins.github.io/' }], status: 'dnd' });
})

bot.on("messageCreate", async (message) =>
{
    if(message.author.id == bot.user.id) return;
    if(!message.guild)
    {
        console.log("DM: " + message.content);
        // try {
        //     let result = await pg_client.query(message.content)
        //     console.log(result)
        // } catch (err) {
        //     console.error(err.stack)
        // }
        let contents = message.content.trim()
        let cn = bot.channels.cache.get(debugchid);
        if(!cn) return console.log('failed to find channel')
        if (/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/.test(contents))
        {
            let verification_message = await tryVerification(cn, contents, message.author.tag);
            bot.users.fetch(message.author.id, false).then((user) => {
                user.send(verification_message);
            });
        }
        else if (vote_options.includes(parseInt(contents)))
        {
            let vote_message = await registerVote(cn, message.author.tag, contents);
            bot.users.fetch(message.author.id, false).then((user) => {
                user.send(vote_message);
            });
        }
        return;
    }

    if(!message.guild || !message.content.startsWith("!")) return;

    if(message.author.id != "534061021304717312" && message.author.id != "328629962162700289" && message.author.id != "603962299895775252") return;

    let cmd = message.content.trim().replace(/  /g, ' ').substring(1).split(" ");

    let param = cmd.slice(1);
    cmd = cmd[0].toLowerCase();

    if(cmd == "test")
    {
        message.channel.send("👍");
    }

    if (cmd == "embed")
    {
        let fields = [
            {"name": "1: Sona (0%)", "value": "░░░░░░░░░░░░░░░░░░░░"}, 
            {"name": "2: Samira (0%)", "value": "░░░░░░░░░░░░░░░░░░░░"}, 
            {"name": "3: Warwick (0%)", "value": "░░░░░░░░░░░░░░░░░░░░"}, 
            {"name": "4: Star Nemesis Morgana (0%)", "value": "░░░░░░░░░░░░░░░░░░░░"}, 
            {"name": "5: Star Guardian Miss Fortune (0%)", "value": "░░░░░░░░░░░░░░░░░░░░"}, 
            {"name": "6: Xayah (0%)", "value": "░░░░░░░░░░░░░░░░░░░░"}, 
            {"name": "7: Garen (0%)", "value": "░░░░░░░░░░░░░░░░░░░░"}, 
        ];
        pg_client.query(`SELECT vote, CAST(SUM(amount) AS FLOAT) / MAX(total) AS vote_percent FROM ${table_metadata.name} CROSS JOIN (SELECT SUM(amount) AS total FROM ${table_metadata.name}) AS Total GROUP BY vote, total ORDER BY vote`).then(async (result) => {
            for (let i = 0; i < result.rows.length; i++)
            {
                if (vote_options.includes(parseInt(result.rows[i][table_metadata.vote])))
                {
                    fields[parseInt(result.rows[i][table_metadata.vote]) - 1]["name"] = fields[parseInt(result.rows[i][table_metadata.vote]) - 1]["name"].slice(0, -3) + parseInt(result.rows[i]["vote_percent"] * 100 + 0.5) + "%)"
                    fields[parseInt(result.rows[i][table_metadata.vote]) - 1]["value"] = "▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓".slice(0, parseInt(result.rows[i]["vote_percent"] * 20 + 0.5)) + "░░░░░░░░░░░░░░░░░░░░".slice(parseInt(result.rows[i]["vote_percent"] * 20 + 0.5));
                }
            }
            message.channel.send({ "embeds": [
                {
                    "type": "rich",
                    "title": `Spring Skin Event 2023`,
                    "description": `Follow the instructions above to participate in the event.`,
                    "color": 0x1eff00,
                    "fields": fields,
                    "image": {
                      "url": `https://media.discordapp.net/attachments/839085704658681937/1082714441214337076/campaign.png`,
                      "height": 0,
                      "width": 0
                    }
                }
                ]
            })
        }).catch(err => {
            console.error(err.stack)
            message.channel.send("Database error")
        });;
    }

    if (cmd == "addemail")
    {
        let em = param[0].trim().toLowerCase();
        let amount = parseInt(param[1].trim())
        addNewEmail(em, amount).then((result) => {
            switch (result)
            {
                case 0:
                    message.channel.send(`${em} added successfully!`);
                    break;
                case 1:
                    message.channel.send(`${em} has been verified`);
                    break;
                case 2:
                case 3:
                    message.channel.send(`${em} was already added`);
                    break;
                default:
                    message.channel.send(`${em} an unknown error occured`);

            }
        });
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

    if(cmd == "verify") // !verify @someone, will check if verified + no roles, add roles if thats the case
    {
        pg_client.query(`SELECT ${table_metadata.username} FROM ${table_metadata.name} WHERE ${table_metadata.verified} = TRUE ;`).then(async (result) => {


            const user = message.mentions.users.first();
            const member = message.mentions.members.first();
            if (!user) return;
            if (!member) return message.channel.send("Failed to find member");
            let guild = bot.guilds.cache.get(serverid);

            if (!guild) return message.channel.send("Failed to find guild");

            let role1 = guild.roles.cache.find(r => r.name == '.');
            let role2 = guild.roles.cache.find(r => r.name == 'Donator');

            for (const key in result.rows) {
                if (Object.hasOwnProperty.call(result.rows, key)) {
                    const e = result.rows[key];
                    console.log(e);

                    if(user.tag.toLowerCase() == e)
                    {

                        if (!member.roles.cache.some(role => role.name == '.'))
                        {
                            member.roles.add(role1);
                            console.log(`Added role to: ${user.tag}`)
                            
                        }

                        if (!member.roles.cache.some(role => role.name == 'Donator'))
                        {
                            member.roles.add(role2);
                            console.log(`Added role to: ${user.tag}`)
                        }
                    }
                }
            }
        }).catch(err => {

            console.log(err);
            message.channel.send("Query error")
        });
        
    }
})


let _token = ""

try {
    // local login
    let { token } = require('./token.json');
    _token = token;
} catch (error) {
    // heroku login
    _token = process.env.DISCORD_TOKEN;
}

bot.login(_token)
