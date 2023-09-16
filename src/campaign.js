'use strict';

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

async function receiveDonation(req, res, campaign) {
    if (campaign == -1 || req.method != "POST") {
        res.writeHead(400);
        res.end()
        return
    }
    let data = []
    req.on('data', (d) => {
        data.push(d)
    });
    req.on('end', async function() {
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