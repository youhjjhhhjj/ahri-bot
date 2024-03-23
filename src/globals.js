'use strict';

const { Client, GatewayIntentBits, Partials } = require('discord.js');

const abId = '993911649511690330'
const serverId = '747424654615904337';
const debugChannelId = '994038938035556444';
const modChannelId = '1158189082577477632';

const protectedChannelIds = new Set(['747425787371716618', '1113124813138051242', '822701232413474816', '747425931148132522', '747425887292620840', '748209748322811904', '1073408805666299974']);
const staffIds = new Set(['603962299895775252', '328629962162700289', '534061021304717312', '447070898868977665']);
const vstaffIds = new Set();

const abClient = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.DirectMessages, GatewayIntentBits.GuildMessageReactions], partials: [Partials.Channel, Partials.Message, Partials.GuildMember], allowedMentions: { parse: ['users'] } });

const pg = require('pg');
const _db = process.env.DATABASE_URL || "";  // insert local database URL
const pgClient = new pg.Pool({
  connectionString: _db,
  ssl: {
    rejectUnauthorized: false
  }
});

module.exports = { abId, serverId, debugChannelId, modChannelId, protectedChannelIds, staffIds, vstaffIds, abClient, pgClient };