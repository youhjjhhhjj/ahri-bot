'use strict';

const { pgClient } = require('../globals.js');


const campaignTypes = {
    base: 'Base',
    goal: 'Goal',
    vote: 'Vote'
};


class Campaign {
    constructor(name, id, embedImage) {
        this.type = campaignTypes.base;
        this.name = name;
        this.id = id;
        this.embedImage = embedImage;
        this.messageId = null;
    }

    async createEmbed() {
        let result = await pgClient.query(`SELECT SUM(amount) AS total FROM ${this.id}`);
        let total = result.rows[0]["total"] || 0;
        return { 'embeds': [
            {
                'type': 'rich',
                'title': this.name,
                'description': "Follow the instructions above to participate in the event.",
                'color': 0x1eff00,
                'fields': [{'name': "Amount:", 'value': `$${total}`}],
                'image': {'url': this.embedImage, 'height': 0, 'width': 0}
            }
        ]};
    }
}


class GoalCampaign extends Campaign {
    constructor(name, id, embedImage, goal) {
        super(name, id, embedImage);
        this.type = campaignTypes.goal;
        this.goal = goal;
    }

    async createEmbed() {
        let result = await pgClient.query(`SELECT SUM(amount) AS total FROM ${this.id}`);
        let total = result.rows[0]["total"] || 0;
        return { 'embeds': [
            {
                'type': 'rich',
                'title': this.name,
                'description': "Follow the instructions above to participate in the event.",
                'color': 0x1eff00,
                'fields': [{'name': ` $${total} out of $${this.goal}`, 'value': '▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓'.slice(0, parseInt(total / this.goal * 20 + 0.5)) + '░░░░░░░░░░░░░░░░░░░░'.slice(parseInt(total / this.goal * 20 + 0.5))}],
                'image': {'url': this.embedImage, 'height': 0, 'width': 0}
            }
        ]};
    }
}


class VoteCampaign extends Campaign {
    constructor(name, id, embedImage, options) {        
        super(name, id, embedImage);
        this.type = campaignTypes.vote;
        this.options = options;
    }

    async createEmbed() {
        let fields = [];
        for (let i = 0; i < this.options.length; i++) {
            fields.push({'name': `${i + 1}: ${this.options[i]} (0% / $0)`, 'value': '░░░░░░░░░░░░░░░░░░░░'});
        }
        let result = await pgClient.query(`SELECT vote, SUM(amount) AS vote_amount, CAST(SUM(amount) AS FLOAT) / MAX(total) AS vote_percent FROM ${this.id} CROSS JOIN (SELECT SUM(amount) AS total FROM ${this.id} WHERE vote IS NOT NULL) AS Total WHERE vote IS NOT NULL GROUP BY vote, total ORDER BY vote`);
        for (let i = 0; i < result.rowCount; i++) {
            if (0 < parseInt(result.rows[i]['vote']) <= this.options.length) {
                fields[parseInt(result.rows[i]['vote']) - 1]['name'] = fields[parseInt(result.rows[i]['vote']) - 1]['name'].slice(0, -8) + parseInt(result.rows[i]['vote_percent'] * 100 + 0.5) + "% / $" + result.rows[i]['vote_amount'] + ")";
                fields[parseInt(result.rows[i]['vote']) - 1]['value'] = '▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓'.slice(0, parseInt(result.rows[i]['vote_percent'] * 20 + 0.5)) + '░░░░░░░░░░░░░░░░░░░░'.slice(parseInt(result.rows[i]['vote_percent'] * 20 + 0.5));
            }
        }
        return { 'embeds': [{
            'type': 'rich',
            'title': this.name,
            'description': "Follow the instructions above to participate in the event.",
            'color': 0x1eff00,
            'fields': fields,
            'image': {'url': this.embedImage, 'height': 0, 'width': 0}
        }]};
    }
}


module.exports = { campaignTypes, GoalCampaign, VoteCampaign };