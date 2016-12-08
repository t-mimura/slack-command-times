const moment = require('moment');

module.exports = (bot, message) => {
  const today = moment().startOf('day');
  const christmas = moment().month(11).date(25).startOf('day');
  if (christmas.isBefore(today)) {
    christmas.add(1, 'y');
  }
  const count = christmas.diff(today, 'days');
  if (count === 0) {
    bot.replyPublic(message, ':tada: メリークリスマス :gift: :santa:');
  } else {
    bot.replyPublic(message, `クリスマスまで後 ${count} 日です`);
  }
};
