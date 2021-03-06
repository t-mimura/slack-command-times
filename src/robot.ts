import * as botkit from 'botkit';
import * as path from 'path';
import * as express from 'express';

import * as compileSass from 'express-compile-sass';

import { logger } from './utils/logger';
import { TaskFunction } from './tasks/common';
import { TokenUtil } from './utils/token-utils';
// tasks
import { christmasTimesTask } from './tasks/christmas-times';
import { timesTask } from './tasks/times';

const secrets = require('../.times/.secrets.json');
const timesConfig = require('../.times/times.config.json');
const env = {
  port: 3000,
  json_file_store_path: path.join(__dirname,  '../.times/.json_file_store/')
};

const scopes = ['commands', 'emoji:read'];

const controller = botkit.slackbot({
  debug: false,
  json_file_store: env.json_file_store_path
}).configureSlackApp({
  clientId: secrets.clientId,
  clientSecret: secrets.clientSecret,
  scopes: scopes
});
TokenUtil.setController(controller);

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
    const logErrors = (err, req, res, next) => {
      logger.error(err.stack);
      next(err);
    };
    const publicRoot = path.join(__dirname, 'public-root');
    webserver.set('views', path.join(__dirname, 'views'));
    webserver.set('view engine', 'pug');

    webserver.use(compileSass({
      root: publicRoot,
      sourceMap: false,
      sourceComments: false,
      watchFiles: true,
      logToConsole: false
    }));
    webserver.use(express.static(publicRoot));
    webserver.use('/times', require('./routes/times/index')(timesConfig.baseUrl, scopes.join(','), secrets.clientId));
    webserver.use('/times/report', require('./routes/times/report')(timesConfig.baseUrl));
    webserver.use('/times/help', require('./routes/times/help')(timesConfig.baseUrl, scopes.join(','), secrets.clientId));
    webserver.use(logErrors);

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
