const { Adapter, TextMessage } = require('hubot'); // eslint-disable-line import/no-extraneous-dependencies
const request = require('request');

class Mattermost extends Adapter {
  send(envelope, ...args) {
    if (args.length === 0) {
      return;
    }

    const text = args.shift();
    if (typeof text === 'function') {
      text();
      this.send(...[envelope].concat(args));
      return;
    }

    request.get({
      url: `${this.mattermostUrl}/hooks/incoming`,
      qs: { team_id: envelope.message.user.mattermostTeamId },
      headers: { Authorization: `Bearer ${this.accessToken}` },
      json: true,
    }, (error, res, body) => {
      if (error) {
        this.robot.logger.error(`Error getting incoming webhooks for team ${envelope.message.user.mattermostTeamId}. ${error.message}`);
        return;
      }

      if (!body.length) {
        this.robot.logger.error(`None incoming webhooks founded for the team ${envelope.message.user.mattermostTeamId}`);
        return;
      }

      const incoming = body.find(x => x.channel_id === envelope.message.user.mattermostChannelId
        && x.display_name === this.robot.name);

      if (!incoming) {
        this.robot.logger.error(`None incoming webhooks founded for the channel ${envelope.message.user.mattermostChannelId}`);
        return;
      }

      const data = {
        icon_url: this.icon,
        username: this.robot.name,
        text,
      };

      request.post({
        url: `${this.mattermostUrl}/hooks/${incoming}`,
        headers: { Authorization: `Bearer ${this.accessToken}` },
        json: true,
        body: JSON.stringify(data),
      }, (posterror) => {
        if (posterror) {
          this.robot.logger.error(`Error sending message ${error.message}`);
        }
      });
    });
  }

  reply(envelope, ...args) {
    const strings = args.map(s => `@${envelope.user.name}: ${s}`);
    this.send(...[envelope].concat(strings));
  }

  run() {
    this.emit('connected');
    this.endpoint = process.env.HUBOT_ENDPOINT;
    this.icon = process.env.HUBOT_ICON;
    this.mattermostUrl = process.env.MATTERMOST_URL;
    this.accessToken = process.env.MATTERMOST_ACCESS_TOKEN;

    if (!this.endpoint) {
      this.robot.logger.emergency('MATTERMOST_ENDPOINT variable is required');
      process.exit(1);
    }

    if (!this.mattermostUrl) {
      this.robot.logger.emergency('MATTERMOST_URL variable is required');
      process.exit(1);
    }

    if (!this.accessToken) {
      this.robot.logger.emergency('MATTERMOST_ACCESS_TOKEN variable is required');
      process.exit(1);
    }

    this.robot.router.post(this.endpoint, (req, res) => {
      const { text } = req.body;
      const user = this.robot.brain.userForId(req.body.user_id);
      user.name = req.body.user_name;
      user.room = req.body.channel_name;
      user.mattermostChannelId = req.body.channel_id;
      user.mattermostTeamId = req.body.team_id;
      this.robot.receive(new TextMessage(user, text));
      res.status(200).end();
    });
  }
}

exports.use = robot => new Mattermost(robot);
