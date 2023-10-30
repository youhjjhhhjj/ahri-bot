'use strict';

var qs = require('querystring');

const { serverId, debugChannelId, abClient, pgClient } = require('../globals.js');
const { campaignTypes, GoalCampaign, VoteCampaign } = require('./campaign-classes.js');

// CREATE TABLE Verification061423 ( email VARCHAR(255) PRIMARY KEY, username VARCHAR(255) UNIQUE, user_id VARCHAR(255) UNIQUE, vote INTEGER, amount NUMERIC(5, 2) DEFAULT 0 ) ;
// CREATE TABLE Verification071123 ( email VARCHAR(255) PRIMARY KEY, username VARCHAR(255) UNIQUE, user_id VARCHAR(255) UNIQUE, amount NUMERIC(5, 2) DEFAULT 0 ) ;
const tableMetadata = {
    email: 'email',
    username: 'username',   
    user_id: 'user_id',
    amount: 'amount'
};

var embedMessageId = null;
var premiumRole = null;
var campaign = null;


async function receiveDonation(req, res) {
    if (campaign === null || req.method != 'POST') {
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
        if (data.type !== "Donation") return;
        let email = data.email.toLowerCase();
        let confirmation = `Received ${data.amount} from ${email}`;
        console.log(confirmation);
        abClient.channels.cache.get(debugChannelId).send(confirmation);
        let result = await pgClient.query(`SELECT * FROM ${campaign.id} WHERE ${tableMetadata.email} = $1 ;`, [email]);
        if (result.rowCount == 0)  // first time donation
        {
            await pgClient.query(`INSERT INTO ${campaign.id} ( ${tableMetadata.email}, ${tableMetadata.amount} ) VALUES ( $1, $2 ) ;`, [email, data.amount]);
            if (campaign.type === campaignTypes.goal) embed();
        }
        else  // existing donator
        {
            await pgClient.query(`UPDATE ${campaign.id} SET ${tableMetadata.amount} = $1 WHERE ${tableMetadata.email} = $2 ;`, [parseFloat(result.rows[0][tableMetadata.amount]) + parseFloat(data.amount), email]);
            if (campaign.type === campaignTypes.goal || (campaign.type === campaignTypes.vote && result.rows[0]['vote'] !== null)) embed();
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
    if (campaign === null || campaign.type !== campaignTypes.vote) return "There is no ongoing vote campaign.";
    if (vote <= 0 || vote > campaign.options.length) return "Invalid vote.";
    try
    {
        let result = await pgClient.query(`SELECT * FROM ${campaign.id} WHERE ${tableMetadata.user_id} = $1 ;`, [user_id]);
        if (result.rowCount == 0) // user_id does not exist
        {
            cn.send(`${username} tried to vote, but wasn't in database`);
            return "You were not found in the database. Did you message me your email first? Contact staff for assistance.";
        }
        else
        {
            await pgClient.query(`UPDATE ${campaign.id} SET vote = $1 WHERE ${tableMetadata.user_id} = $2 ;`, [vote, user_id]);
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
    if (campaign === null) return "There is no ongoing campaign.";
    try
    {
        let result = await pgClient.query(`SELECT * FROM ${campaign.id} WHERE ${tableMetadata.email} = $1 ;`, [email]);
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
                await pgClient.query(`UPDATE ${campaign.id} SET ${tableMetadata.user_id} = $1, ${tableMetadata.username} = $2 WHERE ${tableMetadata.email} = $3 ;`, [user_id, username, email]);
                cn.send(`${username} verified successfully with email ${email}`);
                assignPremiumRole(user_id);

                return (campaign.type === campaignTypes.vote) ? "Successfully verified, now cast your vote." : "Successfully verified.";
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
        let guild = abClient.guilds.cache.get(serverId);    
        let member = await guild.members.fetch(user_id);        
        if (cool === true) member.roles.add(guild.roles.cache.find(r => r.name == 'Cool'));
        member.roles.add(guild.roles.cache.find(r => r.name == premiumRole));
    }
    catch (err)
    {
        console.error(err.stack);
    }
}


async function embed() {
    let embed_message = "Something broke :(";
    try {
        let campaignChannel = abClient.channels.cache.get('1113124813138051242');
        embed_message = await campaign.createEmbed();
        if (embedMessageId !== null) campaignChannel.messages.fetch(embedMessageId).then(message => message.edit(embed_message));
        else campaignChannel.send(embed_message).then((embed) => embedMessageId = embed.id);
    }
    catch (err)
    {
        console.error(err.stack);
    }
}


async function startCampaign(interaction) {  // TODO: add capability to load campaign configuration from database
    let reply = "Something went wrong while trying to start the campaign.";
    let name = interaction.options.getString('name').trim();
    let id = interaction.options.getString('id').trim();
    let createTable = interaction.options.getBoolean('create_table');
    let options = interaction.options.getString('options').trim();
    let embedImage = interaction.options.getString('embed_image');
    let newPremiumRole = interaction.options.getString('premium_role').trim();
    if (isNaN(options)) {
        if (createTable) {
            await pgClient.query(`CREATE TABLE ${id} ( ${tableMetadata.email} VARCHAR(255) PRIMARY KEY, ${tableMetadata.username} VARCHAR(255) UNIQUE, ${tableMetadata.user_id} VARCHAR(255) UNIQUE, vote INTEGER, ${tableMetadata.amount} NUMERIC(5, 2) DEFAULT 0 ) ;`);
        }
        campaign = new VoteCampaign(name, id, embedImage, options.split(',').map(s => s.trim()));
        reply = `Vote campaign started with name ${campaign.name}, id ${campaign.id}, and options ${campaign.options.join(', ')}`;
    }
    else {
        if (createTable) {
            await pgClient.query(`CREATE TABLE ${id} ( ${tableMetadata.email} VARCHAR(255) PRIMARY KEY, ${tableMetadata.username} VARCHAR(255) UNIQUE, ${tableMetadata.user_id} VARCHAR(255) UNIQUE, ${tableMetadata.amount} NUMERIC(5, 2) DEFAULT 0 ) ;`);
        }
        campaign = new GoalCampaign(name, id, embedImage, parseInt(options));
        reply = `Goal campaign started with name ${campaign.name}, id ${campaign.id}, and goal $${campaign.goal}`;
    }
    if (newPremiumRole) premiumRole = newPremiumRole;
    await embed();
    await interaction.reply(reply);
}


async function endCampaign(interaction) {
    campaign = null;
    await interaction.reply("Campaign ended successfully.");
}


async function checkCredit(user_id) {
    let result = await pgClient.query(`SELECT * FROM Credit WHERE ${tableMetadata.user_id} = $1 ;`, [user_id]);
    if (result.rowCount == 0) return "You have no credit balance.";
    return `Your credit balance is $${result.rows[0]["amount"]}.`;
}


async function useCredit(user_id, username) {
    if (campaign === null) return;
    let result = await pgClient.query(`SELECT * FROM Credit WHERE ${tableMetadata.user_id} = $1 ;`, [user_id]);
    if (result.rowCount == 0 || result.rows[0]["amount"] == 0) return "You have no credit balance.";
    let amount = result.rows[0]["amount"];
    await pgClient.query(`UPDATE Credit SET ${tableMetadata.amount} = 0 WHERE ${tableMetadata.user_id} = $1 ;`, [user_id]);
    result = await pgClient.query(`UPDATE ${campaign.id} SET amount = amount + $2 WHERE ${tableMetadata.user_id} = $1`, [user_id, amount]);
    if (result.rowCount == 0) {
        await pgClient.query(`INSERT INTO ${campaign.id} ( ${tableMetadata.email}, ${tableMetadata.user_id}, ${tableMetadata.username}, ${tableMetadata.amount} ) VALUES ( $1, $2, $3, $4 ) ;`, [`${username}@credit`, user_id, username, amount]);
    }
    let confirmation = `${username} used $${amount} of credit`;
    console.log(confirmation);
    abClient.channels.cache.get(debugChannelId).send(confirmation);
    assignPremiumRole(user_id, false);
    embed();
    return `You have successfully applied $${amount} of credit.`;
}


module.exports = { receiveDonation, registerVote, verifyUser, assignPremiumRole, startCampaign, endCampaign, checkCredit, useCredit };