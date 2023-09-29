'use strict';

const { Client, Intents } = require('discord.js');

const debugChannelId = '994038938035556444';
const serverId = '747424654615904337';

const protectedChannels = new Set(['747425787371716618', '1113124813138051242', '822701232413474816', '747425931148132522', '747425887292620840', '748209748322811904', '1073408805666299974']);
const staffIds = new Set(['603962299895775252', '328629962162700289', '534061021304717312', '447070898868977665']);
const vstaffIds = new Set();

const abClient = new Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES, Intents.FLAGS.DIRECT_MESSAGES, Intents.FLAGS.GUILD_MESSAGE_REACTIONS], partials: ['CHANNEL'], allowedMentions: { parse: ['users'] } });

const pg = require('pg');
const _db = process.env.DATABASE_URL || "";  // insert local database URL
const pgClient = new pg.Pool({
  connectionString: _db,
  ssl: {
    rejectUnauthorized: false
  }
});

module.exports = { debugChannelId, serverId, protectedChannels, staffIds, vstaffIds, abClient, pgClient };