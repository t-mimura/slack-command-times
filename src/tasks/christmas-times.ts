import * as moment from 'moment';
import { TaskFunction } from './common';

/**
 * クリスマスまでの日付をカウントするタスクです。
 * @param bot bot
 * @param message message
 */
export const christmasTimesTask : TaskFunction = (bot: any, message: any) => {
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
