'use strict';

const { ButtonBuilder } = require('discord.js');

const buttons = {
    getArtistRole: new ButtonBuilder().setCustomId("get-artist-role").setLabel("Get Artist Role").setStyle('Primary'),
    getModderRole: new ButtonBuilder().setCustomId("get-modder-role").setLabel("Get Modder Role").setStyle('Primary'),
}

module.exports = { buttons };