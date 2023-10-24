'use strict';

const { staffIds, abClient, modChannelId } = require('./globals.js');

const userTimeouts = new Map();
const messageVotes = new Map();  // message_id: {'⬇️': Set[str], '⬆️': Set[str]}
const userBonks = new Map();


async function doMessageVote(message, voter_id, vote) {
    if (userTimeouts.has(message.author.id) && userTimeouts.get(message.author.id) >= message.createdTimestamp) return;
    if (!messageVotes.has(message.id)) messageVotes.set(message.id, {'⬇️': new Set(), '⬆️': new Set()});
    let messageVote = messageVotes.get(message.id);
    messageVote[vote].add(voter_id);
    if (messageVote['⬇️'].size - messageVote['⬆️'].size >= 5) {
        let num_mins = message.createdTimestamp - userTimeouts.get(message.author.id) < 1000 * 60 * 60 ? 30 : 10;  // if less than an hour from previous timeout, set 30 mins instead of 10
        userTimeouts.set(message.author.id, Date.now());
        if (staffIds.has(message.author.id)) message.reply("Shut up mod.");
        else if (message.webhookId) message.reply("Shut up ... server?");
        else if (message.author.bot) message.reply("Shut up bot.");
        else {
            console.log(`${message.author.tag} timed out`);
            message.guild.members.fetch(message.author.id).then((member) => {
                member.timeout(1000 * 60 * num_mins)
                .then(message.reply(`People didn't like this, you have been timed out for ${num_mins} minutes.`))
                .then(setTimeout(() => member.timeout(null).catch(), 1000 * 60 * num_mins))
                .catch(err => console.error(`Error while timing out ${message.author.tag}`));
            })
            .catch(err => message.reply("Something broke while trying to make you shut up..."));
        }
    }
}

async function bonk(member, duration) {
    member.roles.add('1142589211392872620');
    setTimeout(async () => {
        member.roles.remove('1142589211392872620').catch(err => console.error(err.stack));
    }, 1000 * 60 * duration);
}

async function doVoteBonk(message) {
    if (userBonks.has(message.author.id) && userBonks.get(message.author.id) >= message.createdTimestamp) return;
    userBonks.set(message.author.id, Date.now());
    let member = message.member;
    bonk(member, 30);
    abClient.channels.cache.get('1139191006890299463').send(`${message.author} has been bonked for 30 minutes.`);
}

async function moderatorBonk(interaction) {
    let member = interaction.options.getMember('member');
    bonk(member, 15);
    abClient.channels.cache.get(modChannelId).send(`${member.user.toString()} has been bonked for 15 minutes by ${interaction.user.tag}.`);
    abClient.channels.cache.get('1139191006890299463').send(`${member.user.toString()} has been bonked for 15 minutes by a moderator.`);
    await interaction.reply({content: "Successfully bonked user.", ephemeral: true});
}

async function timeout(interaction) {
    let duration = interaction.options.getInteger('duration');
    let member = interaction.options.getMember('member');
    let reason = interaction.options.getString('reason');
    await member.timeout(1000 * 60 * duration);
    abClient.channels.cache.get(modChannelId).send(`${member.user.toString()} has been timed out for ${duration} minutes by ${interaction.user.tag}. \nReason: ${reason}`);
    interaction.channel.send(`${member.user.tag} has been timed out for ${duration} minutes by a moderator.`);
    await interaction.reply({content: "Successfully timed out user.", ephemeral: true});
}

async function deleteMessage(interaction) {
    let messageId = interaction.options.getString('message_id');
    let message = await interaction.channel.messages.fetch(messageId);
    let reason = interaction.options.getString('reason');
    await message.delete().catch(e => {
        interaction.reply({content: "Message could not be found.", ephemeral: true});
        return;
    });
    abClient.channels.cache.get(modChannelId).send(`A message by ${message.author.toString()} in ${interaction.channel.toString()} has been deleted by ${interaction.user.tag}. \nReason: ${reason}`);
    interaction.channel.send(`A message has been deleted by a moderator.`);
    await interaction.reply({content: "Successfully deleted message.", ephemeral: true});
}

module.exports = { doMessageVote, doVoteBonk, moderatorBonk, timeout, deleteMessage };