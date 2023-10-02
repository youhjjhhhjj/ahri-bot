'use strict';

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

const commands = {
    test: new SlashCommandBuilder().setName('test').setDescription("Test"),
    stick: new SlashCommandBuilder().setName('stick').setDescription("Sticks a message to the channel (there can only be one)").setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
        .addStringOption(option => option.setName('message_id').setDescription("The ID of the message to stick").setRequired(true)),
    unstick: new SlashCommandBuilder().setName('unstick').setDescription("Stops sticking a message to the channel").setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
    embed: new SlashCommandBuilder().setName('embed').setDescription("Posts the campaign embed").setDefaultMemberPermissions('0'),
    anon: new SlashCommandBuilder().setName('anon').setDescription("Sends an anonymous message")
        .addStringOption(option => option.setName('message').setDescription("The message to send").setRequired(true)),
};

module.exports = { commands };