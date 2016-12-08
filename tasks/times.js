const moment = require('moment');

module.exports = (bot, message) => {
  bot.replyPublic(message, `⏰ 「${message.text}」やるぞー！`);
};
