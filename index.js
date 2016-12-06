const botkit = require('botkit');
const secrets = require('./.times/.secrets.json');
const env = {
  port: 3000
};

const scopes = ['commands'];
const addToSlackButton = `
  <a href="https://slack.com/oauth/authorize?scope=${scopes.join(',')}&client_id=${secrets.clientId}">
    <img alt="Add to Slack" height="40" width="139"
      src="https://platform.slack-edge.com/img/add_to_slack.png"
      srcset="https://platform.slack-edge.com/img/add_to_slack.png 1x, https://platform.slack-edge.com/img/add_to_slack@2x.png 2x" />
  </a>`;

const controller = botkit.slackbot({
  debug: false
}).configureSlackApp({
  clientId: secrets.clientId,
  clientSecret: secrets.clientSecret,
  scopes: scopes
});

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

controller.on('slash_command', (bot, message) => {
  // message.command === '/times'
  bot.replyPublic(message, `⏰ 「${message.text}」やるぞー！`);
});
