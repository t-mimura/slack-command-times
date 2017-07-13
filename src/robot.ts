import * as botkit from 'botkit';
import * as path from 'path';

import { logger } from './utils/logger';
import { TaskFunction } from './tasks/common';
// tasks
import { christmasTimesTask } from './tasks/christmas-times';
import { timesTask } from './tasks/times';

const secrets = require('../.times/.secrets.json');
const env = {
  port: 3000,
  json_file_store_path: path.join(__dirname,  '../.times/.json_file_store/')
};

const scopes = ['commands'];
const addToSlackButton = `
  <a href="https://slack.com/oauth/authorize?scope=${scopes.join(',')}&client_id=${secrets.clientId}">
    <img alt="Add to Slack" height="40" width="139"
      src="https://platform.slack-edge.com/img/add_to_slack.png"
      srcset="https://platform.slack-edge.com/img/add_to_slack.png 1x, https://platform.slack-edge.com/img/add_to_slack@2x.png 2x" />
  </a>`;

const controller = botkit.slackbot({
  debug: false,
  json_file_store: env.json_file_store_path
}).configureSlackApp({
  clientId: secrets.clientId,
  clientSecret: secrets.clientSecret,
  scopes: scopes
});

const slashCommands : { [key: string]: TaskFunction } = {
  '/times': timesTask,
  '/christmas_times': christmasTimesTask
};

controller.on('slash_command', (bot, message) => {
  try {
    logger.access(message);
    const command = slashCommands[message.command];
    if (command) {
      command(bot, message);
    }
  } catch(ex) {
    logger.exception(ex);
  }
});

export const start = () => {
  controller.setupWebserver(env.port, (err, webserver) => {
    webserver.get('/', (req, res) => {
      res.send(addToSlackButton);
    });
    controller
      .createOauthEndpoints(controller.webserver, (err, req, res) => {
        if (err) {
          res.status(500).send('Error: ' + JSON.stringify(err));
        } else {
          res.send('Success');
        }
      })
      .createWebhookEndpoints(controller.webserver);
  });
};
