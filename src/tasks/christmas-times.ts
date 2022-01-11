import { Context, RespondFn, SlashCommand } from '@slack/bolt';
import { DateTime } from 'luxon';
import { TaskFunction } from './common';

/**
 * クリスマスまでの日付をカウントするタスクです。
 * @param bot bot
 * @param message message
 */
export const christmasTimesTask : TaskFunction = (command: SlashCommand, respond: RespondFn, context: Context) => {
  const today = DateTime.now().startOf('day');
  let christmas = DateTime.now().set({ month: 12, day: 25 }).startOf('day');
  if (christmas < today) {
    christmas = christmas.plus({ year: 1 });
  }
  const count = christmas.diff(today, 'days');
  if (count.days === 0) {
    respond({
      text: ':tada: メリークリスマス :gift: :santa:',
      response_type: 'in_channel'
    });
  } else {
    respond({
      text: `クリスマスまで後 ${count.days} 日です`,
      response_type: 'in_channel'
    });
  }
};
