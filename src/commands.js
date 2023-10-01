'use strict';

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

const commands = {
    test: new SlashCommandBuilder().setName('test').setDescription("Test"),
    stick: new SlashCommandBuilder().setName('stick').setDescription("Sticks a message to the channel (there can only be one)").setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .addStringOption(option => option.setName('message_id').setDescription("The ID of the message to stick").setRequired(true)),
    unstick: new SlashCommandBuilder().setName('unstick').setDescription("Stops sticking a message to the channel").setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
    embed: new SlashCommandBuilder().setName('embed').setDescription("Posts the campaign embed").setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
};

module.exports = { commands };