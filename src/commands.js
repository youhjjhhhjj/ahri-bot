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
    timeout: new SlashCommandBuilder().setName('timeout').setDescription("Time out a member for 30 minutes (for minor rule-breaking) or 12 hours (for staff to review and ban)")
        .addUserOption(option => option.setName('member').setDescription("The member to time out").setRequired(true))
        .addIntegerOption(option => option.setName('duration').setDescription("How long to time out").setRequired(true).addChoices({name: 'short', value: 30}, {name: 'long', value: 720}))
        .setDefaultMemberPermissions('0'),
};

module.exports = { commands };