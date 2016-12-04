const botkit = require('botkit');
const secrets = require('./.times/.secrets.json');
const env = {
  port: 3000
};

const controller = botkit.slackbot({
  debug: false
}).configureSlackApp({
  clientId: secrets.clientId,
  clientSecret: secrets.clientSecret,
  scopes: ['commands']
});

controller.setupWebserver(env.port, (err, webserver) => {
  controller
    .createHomepageEndpoint(controller.webserver)
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
