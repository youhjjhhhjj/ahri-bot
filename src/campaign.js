'use strict';

const { debugChannelId, abClient, pgClient } = require('./globals.js');

// CREATE TABLE Verification061423 ( email VARCHAR(255) PRIMARY KEY, username VARCHAR(255) UNIQUE, user_id VARCHAR(255) UNIQUE, vote INTEGER, amount NUMERIC(5, 2) DEFAULT 0 ) ;
// CREATE TABLE Verification071123 ( email VARCHAR(255) UNIQUE, username VARCHAR(255) UNIQUE, user_id VARCHAR(255) UNIQUE, amount NUMERIC(5, 2) DEFAULT 0 ) ;
const tableMetadata = {
    name: "Verification080423",
    email: 'email',
    username: 'username',   
    user_id: 'user_id',
    vote: 'vote',
    amount: 'amount'
};

const numVoteOptions = 0;

var embedMessageId = null;

const premiumRole = null;


async function receiveDonation(req, res, campaign) {
    if (campaign == -1 || req.method != 'POST') {
        res.writeHead(400);
        res.end();
        return;
    }
    let data = [];
    req.on('data', (d) => {
        data.push(d);
    });
    req.on('end', async function() {
        data = JSON.parse(qs.unescape(Buffer.concat(data)).slice(5));
        let email = data.email.toLowerCase();
        let confirmation = `Received ${data.amount} from ${email}`;
        console.log(confirmation);
        abClient.channels.cache.get(debugChannelId).send(confirmation);
        let result = await pgClient.query(`SELECT * FROM ${tableMetadata.name} WHERE ${tableMetadata.email} = $1 ;`, [email]);
        if (result.rowCount == 0) // first time donation
        {
            await pgClient.query(`INSERT INTO ${tableMetadata.name} ( ${tableMetadata.email}, ${tableMetadata.amount} ) VALUES ( $1, $2 ) ;`, [email, data.amount]);
            if (campaign > 0) embed();
        }
        else
        {
            await pgClient.query(`UPDATE ${tableMetadata.name} SET ${tableMetadata.amount} = $1 WHERE ${tableMetadata.email} = $2 ;`, [parseFloat(result.rows[0][tableMetadata.amount]) + parseFloat(data.amount), email]);
            if (campaign > 0 || (campaign == 0 && result.rows[0][tableMetadata.vote] !== null)) embed();
        }
        res.writeHead(200);
        res.end();
    });
}


async function registerVote(cn, user_id, username, vote)
{
// cases
//  0: user_id does not exist - do nothing
//  1: user_id does exist - set vote
    try
    {
        let result = await pgClient.query(`SELECT * FROM ${tableMetadata.name} WHERE ${tableMetadata.user_id} = $1 ;`, [user_id]);
        if (result.rowCount == 0) // user_id does not exist
        {
            cn.send(`${username} tried to vote, but wasn't in database`);
            return "You were not found in the database. Did you message me your email first? Contact staff for assistance.";
        }
        else
        {
            await pgClient.query(`UPDATE ${tableMetadata.name} SET ${tableMetadata.vote} = $1 WHERE ${tableMetadata.user_id} = $2 ;`, [vote, user_id]);
            cn.send(`${username} voted for ${vote}`);
            embed();
            return "Vote successfully added.";
        }
    }
    catch (err)
    {
        console.error(err.stack);
    }
    return "Something went wrong, contact staff for assistance.";
}


async function verifyUser(cn, email, user_id, username)
{
    try
    {
        let result = await pgClient.query(`SELECT * FROM ${tableMetadata.name} WHERE ${tableMetadata.email} = $1 ;`, [email]);
        // console.log(result)
        if(result.rowCount == 0 || (result.rows[0][tableMetadata.user_id] !== null && result.rows[0][tableMetadata.user_id] !== user_id)) // email does not exist or exists with different user_id
        {
            cn.send(`${username} tried to verify, but wasn't in database`);
            return "This email was not found in the database. Are you sure it's your ko-fi email? Contact staff for assistance.";
        }
        else // email already exists
        {
            if (result.rows[0][tableMetadata.user_id] !== null)
            {
                cn.send(`${username} tried to verify with existing email ${email}`);
                return "You have already been verified.";
            }
            else
            {
                await pgClient.query(`UPDATE ${tableMetadata.name} SET ${tableMetadata.user_id} = $1, ${tableMetadata.username} = $2 WHERE ${tableMetadata.email} = $3 ;`, [user_id, username, email]);
                cn.send(`${username} verified successfully with email ${email}`);
                assignPremiumRole(user_id);

                return (campaign == 0) ? "Successfully verified, now cast your vote." : "Successfully verified.";
            }
        }
    }
    catch (err)
    {
        console.error(err.stack);
        cn.send(`An unknown error occured while trying to verify ${username} with email ${email}`);
        return "An unknown error occured, please try again later.";
    }
}


async function assignPremiumRole(user_id, cool = true) {
    try {
        let guild = abClient.guilds.cache.get(serverid);    
        let member = await guild.members.fetch(user_id);        
        if (cool === true) member.roles.add(guild.roles.cache.find(r => r.name == 'Cool'));
        member.roles.add(guild.roles.cache.find(r => r.name == premiumRole));
    }
    catch (err)
    {
        console.error(err.stack);
    }
}



async function createEmbedVote() {
    let fields = [
        {'name': "1: Riven (0% / $0)", 'value': '░░░░░░░░░░░░░░░░░░░░'}, 
        {'name': "2: Fiddlesticks (0% / $0)", 'value': '░░░░░░░░░░░░░░░░░░░░'}, 
        {'name': "3: Sona (0% / $0)", 'value': '░░░░░░░░░░░░░░░░░░░░'}, 
        {'name': "4: Gwen (0% / $0)", 'value': '░░░░░░░░░░░░░░░░░░░░'}, 
        {'name': "5: Pool Party Graves (0% / $0)", 'value': '░░░░░░░░░░░░░░░░░░░░'}, 
        {'name': "6: Soraka (0% / $0)", 'value': '░░░░░░░░░░░░░░░░░░░░'}, 
    ];
    let result = await pgClient.query(`SELECT vote, SUM(amount) AS vote_amount, CAST(SUM(amount) AS FLOAT) / MAX(total) AS vote_percent FROM ${tableMetadata.name} CROSS JOIN (SELECT SUM(amount) AS total FROM ${tableMetadata.name} WHERE ${tableMetadata.vote} IS NOT NULL) AS Total GROUP BY vote, total ORDER BY vote`);
    for (let i = 0; i < result.rowCount; i++)
    {
        if (0 < parseInt(result.rows[i][tableMetadata.vote]) <= numVoteOptions)
        {
            fields[parseInt(result.rows[i][tableMetadata.vote]) - 1]['name'] = fields[parseInt(result.rows[i][tableMetadata.vote]) - 1]['name'].slice(0, -8) + parseInt(result.rows[i]['vote_percent'] * 100 + 0.5) + "% / $" + result.rows[i]['vote_amount'] + ")";
            fields[parseInt(result.rows[i][tableMetadata.vote]) - 1]['value'] = '▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓'.slice(0, parseInt(result.rows[i]['vote_percent'] * 20 + 0.5)) + '░░░░░░░░░░░░░░░░░░░░'.slice(parseInt(result.rows[i]['vote_percent'] * 20 + 0.5));
        }
    }
    return { 'embeds': [
        {
            'type': 'rich',
            'title': '',
            'description': "Follow the instructions above to participate in the event.",
            'color': 0x1eff00,
            'fields': fields,
            'image': {
                'url': '',
                'height': 0,
                'width': 0
            }
        }
    ]};
}

async function createEmbedCampaign() {
    let result = await pgClient.query(`SELECT SUM(amount) AS total FROM ${tableMetadata.name}`);
    let total = result.rows[0]["total"] || 0;
    return { 'embeds': [
        {
            'type': 'rich',
            'title': '',
            'description': "Follow the instructions above to participate in the event.",
            'color': 0x1eff00,
            'fields': [{'name': ` $${total} out of $${campaign}`, 'value': '▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓'.slice(0, parseInt(total / campaign * 20 + 0.5)) + '░░░░░░░░░░░░░░░░░░░░'.slice(parseInt(total / campaign * 20 + 0.5))}],
            'image': {
                'url': '',
                'height': 0,
                'width': 0
            }
        }
    ]};
}


async function embed() {
    let embed_message = "Something broke :(";
    try {
        let campaign_channel = abClient.channels.cache.get('1113124813138051242');
        if (campaign == 0) embed_message = await createEmbedVote();
        else if (campaign > 0) embed_message = await createEmbedCampaign();
        if (embedMessageId !== null) campaign_channel.messages.fetch(embedMessageId).then(message => message.edit(embed_message));
        else campaign_channel.send(embed_message).then((embed) => embedMessageId = embed.id);
    }
    catch (err)
    {
        console.error(err.stack);
    }
}


async function checkCredit(user_id) {
    let result = await pgClient.query(`SELECT * FROM Credit WHERE ${tableMetadata.user_id} = $1 ;`, [user_id]);
    if (result.rowCount == 0) return "You have no credit balance.";
    return `Your credit balance is $${result.rows[0]["amount"]}.`;
}


async function useCredit(user_id, username) {
    let result = await pgClient.query(`SELECT * FROM Credit WHERE ${tableMetadata.user_id} = $1 ;`, [user_id]);
    if (result.rowCount == 0 || result.rows[0]["amount"] == 0) return "You have no credit balance.";
    let amount = result.rows[0]["amount"];
    await pgClient.query(`UPDATE Credit SET ${tableMetadata.amount} = 0 WHERE ${tableMetadata.user_id} = $1 ;`, [user_id]);
    result = await pgClient.query(`UPDATE ${tableMetadata.name} SET amount = amount + $2 WHERE ${tableMetadata.user_id} = $1`, [user_id, amount]);
    if (result.rowCount == 0) {
        await pgClient.query(`INSERT INTO ${tableMetadata.name} ( ${tableMetadata.user_id}, ${tableMetadata.username}, ${tableMetadata.amount} ) VALUES ( $1, $2, $3 ) ;`, [user_id, username, amount]);
    }
    let confirmation = `${username} used $${amount} of credit`;
    console.log(confirmation);
    abClient.channels.cache.get(debugChannelId).send(confirmation);
    assignPremiumRole(user_id, false);
    embed();
    return `You have successfully applied $${amount} of credit.`;
}

module.exports = { receiveDonation, registerVote, verifyUser, assignPremiumRole, embed, checkCredit, useCredit };