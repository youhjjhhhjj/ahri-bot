'use strict';

const { SlashCommandBuilder } = require('discord.js');

const commands = {
    test: new SlashCommandBuilder().setName('test').setDescription("Test"),
    stick: new SlashCommandBuilder().setName('stick').setDescription("Sticks a message to the channel"),
    stickstop: new SlashCommandBuilder().setName('stickstop').setDescription("Stops sticky messages in the channel"),
    embed: new SlashCommandBuilder().setName('embed').setDescription("Posts the campaign embed"),
};

module.exports = { commands };