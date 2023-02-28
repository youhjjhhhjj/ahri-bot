'use strict';
const { Client, Intents, MessageEmbed } = require('discord.js');
const bot = new Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES, Intents.FLAGS.DIRECT_MESSAGES], partials: ["CHANNEL"] });
const fs = require('fs');
const path = require('path');
const debugchid = '994038938035556444';
const serverid = '747424654615904337';
const pg = require('pg');
const _db = process.env.DATABASE_URL || "postgres://lfzildwxwprjyx:1fd6dbee3ad2be224e5920eed7fcec2af76fca1effb1615b132be6882fe611e5@ec2-3-217-14-181.compute-1.amazonaws.com:5432/d3qvi3t6vjrgq1";
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
// CREATE TABLE Verification101522 (email VARCHAR( 255 ) PRIMARY KEY, username VARCHAR( 255 ) UNIQUE, verified BOOLEAN NOT NULL DEFAULT FALSE ) ;
const table_metadata = {
    name: "Verification101522",
    email: "email",
    username: "username",
    verified: "verified"
}

function maybeRead(path2)
{
    let rawdata;
    let apath = path.join(__dirname, path2);

    let temp;
    try {
        rawdata = fs.readFileSync(apath);
        temp = JSON.parse(rawdata);
    } catch (error) {

        
        console.log("failed to read1 " + apath)
        //console.log(error)

        try {
            temp = require(apath);
        } catch (e2) {
            console.log("failed to read2 " + apath)
            //console.log(e2)
            temp = {};
        }

    }
    return temp;
}
let skins = maybeRead('./skins.json');

const regex = /http.*discord.*channels\/([0-9]+)\/([0-9]+)\/([0-9]+)/;

function addJson(obj, path2, key, value, force = false)
{

    if ((value+key+"").includes('"')) return 1;

    if(obj[key] && force == false) return 2;

    obj[key] = value;
    
    fs.writeFileSync(path.join(__dirname, path2) , JSON.stringify(obj, null, 4));
    return 0;
}

function deleteJson(obj, path2, key)
{

    if (!obj[key]) return 1;
    delete obj[key];
    
    fs.writeFileSync(path.join(__dirname, path2) , JSON.stringify(obj, null, 4));

    return 0;
}

function addSkin(skin, url)
{
    return addJson(skins, './skins.json', skin, url);
}
function deleteSkin(skin)
{
    return deleteJson(skins, './skins.json', skin)
}

async function addNewEmail(email)
// cases
//  0: email didn't exist - added email
//  1: email existed, username not null, not verified - verified
//  2: email existed and username is null - do nothing
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
                await pg_client.query(`INSERT INTO ${table_metadata.name} ( ${table_metadata.email}, ${table_metadata.username}, ${table_metadata.verified} ) VALUES ( $1, $2, $3 ) ;`, [email, null, false])
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
                    await pg_client.query(`UPDATE ${table_metadata.name} SET ${table_metadata.verified} = $1 WHERE ${table_metadata.email} = $2 ;`, [true, email])
                    
                    let guild = bot.guilds.cache.get(serverid);

                    if (!guild) return cn.send("Failed to find guild");
        
                    let user = bot.users.cache.find(u => {
        
                        console.log(u.tag, result.rows[0][table_metadata.username]);
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
                else
                {
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
                await pg_client.query(`INSERT INTO ${table_metadata.name} ( ${table_metadata.email}, ${table_metadata.username}, ${table_metadata.verified} ) VALUES ( $1, $2, $3 ) ;`, [email, username, false])
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

async function tryVerification(cn, email, username)
{
    let em = email.trim().toLowerCase();
    let us = username.toLowerCase()

    let result = await verifyEmail(em, us);
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
        if(/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/.test(message.content))
        {   
            let cn = bot.channels.cache.get(debugchid);
            if(!cn) return console.log('failed to find channel')
            // cn.send(`${message.author.tag}: ${message.content}`);
            let verification_message = await tryVerification(cn, message.content, message.author.tag);
            bot.users.fetch(message.author.id, false).then((user) => {
                user.send(verification_message);
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

    if(cmd == "view")
    {
        const keys = Object.keys(skins);
        
        let result = ""
        let emsg;
        var a = message.channel.send("Fetching messages...").then(msg => {
            emsg = msg;
          });
        for (const key in skins) {
            if (Object.hasOwnProperty.call(skins, key)) {
                var matches = skins[key].match(regex);
                if(matches && matches[0] && matches[1] && matches[2] && matches[3])
                {
                    console.log(matches[2])
                    console.log(matches[3])
                    var ch = bot.channels.cache.get(matches[2]);
                    var msg = await ch.messages.fetch(matches[3]);
                    var reactions = await msg.reactions.cache.get('🔼') || await msg.reactions.cache.get('⬆️') ||  await msg.reactions.cache.get('⏫');
                    if (reactions) reactions = reactions.count;
                    else reactions = 0;
                    p_skins[key] = reactions;
                } else {
                    p_skins[key] = skins[key];
                }
            }
        }


        let sortable = [];
        for (var a in p_skins) {
            sortable.push([a, p_skins[a]]);
        }

        sortable.sort(function(a, b) {
            return b[1] - a[1];
        });

        const embed = new MessageEmbed()
        let result0 = [];
        let result1 = [];
        let result2 = [];
        sortable.forEach((key, index) => {
            //result1.push(`${index + 1}.`);
            result1.push(key[0]);
            result2.push(key[1]);
        });

        //embed.addField("Skins", result1.join('\n'), true);
        embed.addField("Skins", result1.join('\n'), true);
        embed.addField("​", "​", true);
        embed.addField("Votes", result2.join('\n'), true);
        message.channel.send({ embeds: [embed] }).then((msg) =>
        {
            emsg.delete();
        })
    }

    if(cmd == "addskin")
    {
        var res = addSkin(param.slice(0, -1).join(' '), param.slice(-1)[0]);
        console.log("adding " + param.slice(0, -1).join(' '));
        if(res == 0)
        {
            message.channel.send("Done");
        } else if(res == 1) {
            message.channel.send("Key already exists");
        } else if (res == 2) {
            message.channel.send("Done, unsaved");
        } else {
            message.channel.send("bad url lol");
        }
    }

    if(cmd == "delskin")
    {
        var res = deleteSkin(param.join(' '));
        if(res == 0)
        {
            message.channel.send("Done");
        } else if(res == 1) {
            message.channel.send("Key already exists");
        } else {
            message.channel.send("Done, unsaved");
        }
    }

    if (cmd == "embed")
    {
        param[0] = parseInt(param[0]);
        param[1] = parseInt(param[1]);
        param[2] = parseInt(param[2]);
        param[3] = parseInt(param[3]);
        param[4] = parseInt(param[4]);
        if(!isNaN(param[0]+ param[1] + param[2]))
        {
            param[0] = ` (${param[0]}% of goal)`;
            param[1] = ` (${param[1]}% of goal)`;
            param[2] = ` (${param[2]}% of goal)`;
        } else {
            param[0] = param[1] = param[2] = param[3] = param[4] = '';
        }
        message.channel.send({ "embeds": [
            {
              "type": "rich",
              "title": `LeagueSkinsNSFW Skin Campaign Autumn 2022`,
              "description": `Follow these Ko-Fi links to contribute to the Campaigns of your choice.`,
              "color": 0x40802b,
              "fields": [
                {
                  "name": `Star Guardian Sona - $150${param[0]}`,
                  "value": `https://ko-fi.com/leagueskins2`
                },
                {
                  "name": `Bunny Gwen - $150${param[1]}`,
                  "value": `http://ko-fi.com/leagueskins3`
                },
                {
                  "name": `Spirit Blossom Tristana - $160${param[2]}`,
                  "value": `https://ko-fi.com/leagueskins4`
                }
              ],
              "image": {
                "url": `https://media.discordapp.net/attachments/747425787371716618/1029589304210632704/vote_winner.png`, // wiener
                "height": 0,
                "width": 0
              }
            }
          ]});
    }

    if (cmd == "addemail" || cmd == "addemails")
    {
        for (var e of param)
        {
            let em = e.trim().toLowerCase();
            addNewEmail(em).then((result) => {
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
    }

    // if(cmd == "viewemail" || cmd == "viewemails")
    // {
    //     message.channel.send("```" + JSON.stringify(emails, null, 4) + "```");
    // }

    if (cmd == "querydb") // this doesn't work
    {

        var query = message.content.slice(9);
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

    let fetchedUSers = [];
	
	if (cmd == 'listreactions')
	{
		const channelS = bot.channels.cache.get('747784406801842196')
        let message = [];

	    channelS.messages.fetch({ limit: 100 }).then(messages => { //<---error here
            messages.forEach(async (msg) => 
            {
                var msg = await channelS.messages.fetch(msg.id);
                var reactions = await msg.reactions.cache.get('🔼') || await msg.reactions.cache.get('⬆️') ||  await msg.reactions.cache.get('⏫');
                
                if(reactions)
                {
                    //console.log(reactions.count)
                    if (reactions.count > 45)
                    {
                        message.push([msg, reactions]);
                    }
                    
                }
            })
		});
        let newusers = {};
        newusers = {

          };
          let i_c = 0;
          let filtered = {};
        setTimeout(() => {

            /*
            for (const msg of message) {
                    msg[0].reactions.cache.map(async (reaction) => { //Maps out every reaction made on the collected message
                    if(msg[0].id ) //== '1027056554668736613' || msg[0].id == '1027056696180346880' || msg[0].id == '1028320496867090483' 
                    {
                        let usersThatReacted = [];
                        if (reaction.emoji.name !== "⬆️") return;        //If the reaction checked isn't equal to ⬆️, return
                        let reactedUsers = await reaction.users.fetch(); //Fetches the users that reacted with the ⬆️  on the collected message
                        
                        await reactedUsers.map(async (user) => {              //Maps out every user that reacted with ⬆️
                            let e = await channelS.guild.members.fetch(user.id);
                            if(e && e.joinedAt)
                            {
                                
                                let t = e.joinedAt.toISOString().split('T')[0].split('-');
                                if(t[0] == 2022 && t[1] == 10)
                                {                                
                                    console.log('removed reaction from ' + user.username)
                                } else 
                                {
                                    if(!filtered[msg[0].id]) filtered[msg[0].id] = {};
                                    let rValue = 1;

                                    if (e.roles.cache.some(role => role.name == 'Donator'))
                                    {
                                        console.log(user.username + ' epik +5 vote')
                                        rValue = 5;
                                    }
                                    filtered[msg[0].id].reactionCounter = filtered[msg[0].id].reactionCounter ? (filtered[msg[0].id].reactionCounter+ rValue) : rValue;
                                }
                                console.log(filtered)
                                console.log(`i: ${i_c++}`)
                            }
                        }); 
                    }

                });


            }*/
            console.log('finished')

            var filresult = [
                ['1029035061846212739',47 ],
                ['1028569357405655101',87 ],
                ['1028533983543312465',136 ],
                ['1028486334320480286',72 ],
                ['1028263883837808691',114 ],
                ['1027729019501821964',82 ],
                ['1027573741561069598',89 ],
                ['1027455550851653692',132 ],
                ['1027373422562512958',80 ],
                ['1027317773157797908',108 ],
                ['1027056696180346880',85 ],
                ['1027056554668736613',143 ],
                ['1027034593154572368',94 ],
                ['1027013988371927090',127 ],
                ['1027007490128359504',74 ],
                ['1026998595221729322',59 ],
                ['1026997788065665126',107 ],
                ['1026996185917046895',108 ],
                ['1026994282147618867',91 ],
                ['1026993418947276922',94 ],
                ['1026985577658208286',87 ],
                ['1026984761798963210',76 ],
                ['1026979289805115392',127 ],
                ['1026978036215717928',72 ],
                ['1026973833581830245',119 ],
                ['1026973317799870518',126 ],
                ['1026972569984843897',77 ],
                ['1028320496867090483',42 ]
            ]
            
                filresult = filresult.sort(function(a, b) {
                    if(a[1] > b[1]) { return -1; }
                    if(a[1] < b[1]) { return 1; }
                    return 0;
                });

                filresult.map((c,i) => console.log((i+1).toString().padStart(2), '. https://discord.com/channels/747424654615904337/747784406801842196/' + c[0]))
/*      
                unfilresult = unfilresult.sort(function(a, b) {
                    if(a[1] > b[1]) { return -1; }
                    if(a[1] < b[1]) { return 1; }
                    return 0;
                });

                filresult.map((c,i) => console.log((i+1).toString().padStart(2), '. https://discord.com/channels/747424654615904337/747784406801842196/' + c[0]))

                console.log('--------------------------')

                unfilresult.map((c,i) => console.log((i+1).toString().padStart(2), '. https://discord.com/channels/747424654615904337/747784406801842196/' + c[0]))

                console.log('--------------------------')

                for (let i = 0; i < filresult.length; i++) {
                    for (let j = 0; j < unfilresult.length; j++) {
                        if(unfilresult[j][0] == filresult[i][0])
                        {
                            console.log((i+1).toString().padStart(2), '. https://discord.com/channels/747424654615904337/747784406801842196/' + filresult[i][0], unfilresult[j][1] - filresult[i][1]);
                            break;
                        }
                    }
                    
                }*/
            
            for (const msg of message) {
                var t = {};
                t[msg[0].id]={}
                t[msg[0].id].reactionCounter = msg[1].count
                console.log(t)
            }

            for (const key in newusers) {
                if (Object.hasOwnProperty.call(newusers, key)) {
                    const e = newusers[key];
                    //console.log("'" + key + "', //" + e.username + " joined this month ( " + e.reactions + " )");
                }
            }


            message = message.sort(function(a, b) {
                if(a[1].count < b[1].count) { return -1; }
                if(a[1].count > b[1].count) { return 1; }
                return 0;
            });
            message.reverse();
            for (const msg of message) {
                //console.log('https://discord.com/channels/747424654615904337/747784406801842196/' + msg[0].id)
            }
        }, 6000);
       
	}
	
	if (cmd == 'delreactions')
	{
		
	}

    if(cmd == "verify") // !verify @someone, will check if verified + no roles, add roles if thats the case
    {
        pg_client.query("SELECT username FROM Verification101522 WHERE verified = TRUE ;").then(async (result) => {


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
                            //member.roles.add(role1);
                            console.log(`Added role to: ${user.tag}`)
                            
                        }

                        if (!member.roles.cache.some(role => role.name == 'Donator'))
                        {
                            //member.roles.add(role2);
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
    _token = process.env.AA;
}

bot.login(_token)
