import { App, ExpressReceiver } from '@slack/bolt'
import * as path from 'path';
import * as express from 'express';

import compileSass from 'express-compile-sass';

import { logger } from './utils/logger';
import { TaskFunction } from './tasks/common';
import { myInstallationStore } from './utils/my-installation-store'

// tasks
import { christmasTimesTask } from './tasks/christmas-times';
import { timesTask } from './tasks/times';

const secrets = require('../.times/.secrets.json');
const timesConfig = require('../.times/times.config.json');

const scopes = ['commands', 'chat:write', 'emoji:read'];

const receiver = new ExpressReceiver({
  signingSecret: secrets.signingSecret,
  clientId: secrets.clientId,
  clientSecret: secrets.clientSecret,
  stateSecret: 'slack-slash-command-times-state-secret',
  scopes,
  installationStore: myInstallationStore
});

const app = new App({
  receiver
});

const slashCommands : { [key: string]: TaskFunction } = {
  '/times': timesTask,
  '/christmas_times': christmasTimesTask
};

app.command(/.+/, async ({ ack, respond, command, context }) => {
  try {
    logger.access(command);
    await ack();
    const commandFunc = slashCommands[command.command];
    if (commandFunc !== undefined) {
      commandFunc(command, respond, context);
    }
  } catch (ex) {
    logger.exception(ex);
  }
});

const logErrors = (err, req, res, next) => {
  logger.error(err.stack);
  next(err);
};
const publicRoot = path.join(__dirname, 'public-root');
receiver.app.set('views', path.join(__dirname, 'views'));
receiver.app.set('view engine', 'pug');

receiver.app.use(compileSass({
  root: publicRoot,
  sourceMap: false,
  sourceComments: false,
  watchFiles: true,
  logToConsole: false
}));
receiver.app.use(express.static(publicRoot));
receiver.app.use('/', require('./routes/index')(timesConfig.baseUrl, scopes.join(','), secrets.clientId));
receiver.app.use('/report', require('./routes/report')(timesConfig.baseUrl));
receiver.app.use('/help', require('./routes/help')(timesConfig.baseUrl, scopes.join(','), secrets.clientId));
receiver.app.use(logErrors);

export const start = async () => {
  await app.start({
    port: 3001
  });
  console.log('⚡️ Bolt app started');
}
