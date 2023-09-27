'use strict';


const user_timeouts = new Map();
const message_votes = new Map();  // message_id: {'⬇️': Set[str], '⬆️': Set[str]}
const user_bonks = new Map();



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

async function bonk(message) {
    if (user_bonks.has(message.author.id) && user_bonks.get(message.author.id) >= message.createdTimestamp) return
    user_bonks.set(message.author.id, message.createdTimestamp)
    message.member.roles.add("1142589211392872620")
    setTimeout(async () => {
        let guild = bot.guilds.cache.get(serverid);
        let member = await guild.members.fetch(message.author.id)
        member.roles.remove("1142589211392872620").catch(err => console.error(err.stack))
    }, 1000 * 60 * 60)
    bot.channels.cache.get("1139191006890299463").send(`${message.author} has been bonked.`);
}