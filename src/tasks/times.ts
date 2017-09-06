import * as path from 'path';
import * as moment from 'moment';

import { TaskFunction } from './common';
import { CurrentTask, CurrentTaskDao } from '../data-access/current-task-dao';
import { DoneTask, DoneTaskDao } from '../data-access/done-task-dao';
import { InteractiveContext, InteractiveContextManager } from '../utils/interactive-message-utils';

const timesConfig = require('../../.times/times.config.json');

// TODO: ユーザ情報からそのユーザのタイムゾーンを取得したい
const TIME_ZONE = 9 * 60;
/** 不正な作業終了時間を設定した場合のエラー */
const INVALID_BACK_DATE = 'INVALID_BACK_DATE';

const OK_RESPONSE_TEXT = 'OK!';

/**
 * 入力されたコマンド文字を解析した結果を表す型定義です。
 */
type Command = {
  taskName: string;
  backDate: Date | undefined;
};

/*
 * 引数の hh:mm 形式の文字列でしていされた時刻の直近のDateオブジェクトを取得します。
 * (当日まだ hh:mm が訪れていないときは前日のデータで返します。)
 * @param hhmm 時刻形式の文字列
 * @return Dateオブジェクト
 */
function getLatestDate(hhmm: string): Date {
  const splited = hhmm.split(':');
  const hour = Number(splited[0]);
  const minute = Number(splited[1]);
  const target = moment().utcOffset(TIME_ZONE).hour(hour).minute(minute);
  if (target.isAfter(moment())) {
    target.subtract(1, 'days');
  }
  return target.toDate();
}

/**
 * 指定した数字[分]まえのDateオブジェクトを取得します。
 * @param diffMinutes 差し引く時間(分)
 * @return Dateオブジェクト
 */
function getBackDate(diffMinutes: string): Date {
  const diffMinutesNumber = Number(diffMinutes);
  return new Date(Date.now() - diffMinutesNumber * 60 * 1000);
}

/**
 * コマンドの引数の文字列から、コマンド指示の構成を解析します。
 * @param messageText ユーザが入力した文字列
 * @return 解析結果
 */
function parseCommand(messageText: string): Command {
  let taskName = messageText.trim();
  let backDate: Date | undefined = undefined;
  let matched = taskName.match(/^(.+)\s+back\s+([0-2]?[0-9]:[0-5]?[0-9])$/);
  if (matched) {
    taskName = matched[1];
    backDate = getLatestDate(matched[2]);
  } else {
    matched = taskName.match(/^(.+)\s+back\s+([0-9]+)$/);
    if (matched) {
      taskName = matched[1];
      backDate = getBackDate(matched[2]);
    }
  }
  return {
    taskName: taskName,
    backDate: backDate
  };
}

/*
 * 実行中のタスクを backDate に作業が終わっていたとして設定します。
 * backDate が startTime より早い時間の場合は例外が発生します。
 * @param currentTask 現在のタスクオブジェクト
 * @param backDate さかのぼる日付
 */
function finishCurrentTask(currentTask: CurrentTask, backDate: Date): void {
  const diffTime = backDate.getTime() - currentTask.startTime.getTime();
  if (diffTime < 0) {
    throw new Error(INVALID_BACK_DATE);
  }
  currentTask.endTime = backDate;
}

/**
 * 現在作業しているタスクの名前をレスポンスします。
 * @param bot bot オブジェクト
 * @param message messageオブジェクト
 */
function displayCurrentTask(bot: any, message: any): void {
  const ctDao = new CurrentTaskDao();
  ctDao.findLatest(message).then(result => {
    let currentTaskText: string = '';
    if (result) {
      currentTaskText = `いまは「 ${result.taskName} 」をやっているよー `;
    } else {
      currentTaskText = 'いまはなにもしていないよー';
    }
    const webPageUrl = timesConfig.host + path.join(timesConfig.baseUrl, 'times/');
    const helpPageUrl = timesConfig.host + path.join(timesConfig.baseUrl, 'times/help/');
    const context = InteractiveContextManager.getInstance().createContext('times command', message);
    const reportPageUrl = timesConfig.host + path.join(timesConfig.baseUrl, 'times/report', context.id, '');
    bot.replyPrivate(message, {
      text: currentTaskText,
      attachments: [{
        fallback: `report page: <${reportPageUrl}>`,
        author_name: 'times',
        author_link: webPageUrl,
        title: 'report page',
        title_link: reportPageUrl,
        text: `This URL is valid until ${InteractiveContextManager.expirationPeriodHours} hours.`,
        color: timesConfig.attachmentsColor
      }, {
        fallback: `help page: <${helpPageUrl}>`,
        title: 'help page',
        title_link: helpPageUrl,
        color: timesConfig.attachmentsColor
      }]
    });
  });
}

/**
 * 表示用にタスクを集計して文字列で取得します。
 * @param doneTasks 集計したい終了タスクの配列
 * @return リストアップした結果の文字列
 */
function listupTasksForDisplay(doneTasks: DoneTask[]): string {
  let wholeTotal = 0;
  const totalPerTaskName: { [key: string]: number } = {};
  doneTasks.forEach(doneTask => {
    const total = totalPerTaskName[doneTask.taskName] || 0;
    const diff = doneTask.endTime.getTime() - doneTask.startTime.getTime();
    wholeTotal += diff;
    totalPerTaskName[doneTask.taskName] = total + diff;
  });
  const taskNames = Object.keys(totalPerTaskName);
  let result: string[] = [];
  taskNames.forEach(taskName => {
    result.push([
      `"${taskName}"`,
      moment.duration(totalPerTaskName[taskName], 'millisecond').humanize(),
      '(' + Math.floor(totalPerTaskName[taskName] / wholeTotal * 100) + '%)'
    ].join(' '));
  });
  return result.join('\n');
}

/**
 * 当日の作業を集計して終了タスクに移動します。
 * @param bot botオブジェクト
 * @param message messageオブジェクト
 */
function clockOut(bot: any, message: any): void {
  const ctDao = new CurrentTaskDao();

  ctDao.findAll(message).then(currentTasks => {
    if (currentTasks.length === 0) {
      bot.replyPrivate(message, '今日はまだ働いてないよ :sleeping:');
      return;
    }
    // 当日タスクから終了タスクを作成する.
    const doneTasks: DoneTask[] = currentTasks.map<DoneTask>(currentTask => {
      return {
        startTime: currentTask.startTime,
        endTime: currentTask.endTime || new Date(),
        teamId: currentTask.teamId,
        userId: currentTask.userId,
        taskName: currentTask.taskName
      };
    });
    // 当日タスクを全て削除する
    ctDao.remove(message).then(result => {
      // 終了タスクを追加する
      const dtDao = new DoneTaskDao();
      dtDao.addAll(doneTasks).then(result => {
        const listups = listupTasksForDisplay(doneTasks);
        bot.replyPrivate(message, OK_RESPONSE_TEXT);
        bot.replyPublicDelayed(message, {
          text: `<@${message.user_id}>さん、おつかれさまー :honey_pot:`,
          attachments: [{
            text: listups,
            color: timesConfig.attachmentsColor
          }]
        });
      });
    });
  });
}

/**
 * 新規のタスクを開始します。
 * @param bot botオブジェクト
 * @param message messageオブジェクト
 */
function startTask(bot: any, message: any): void {
  const command = parseCommand(message.text);
  const ctDao = new CurrentTaskDao();
  const startTime = command.backDate ? command.backDate : new Date();
  ctDao.findLatest(message).then(current => {
    let currentUpdatePromise: Promise<any>;
    if (current) {
      // 現在のタスクを終了
      try {
        finishCurrentTask(current, startTime);
      } catch(e) {
        if (e.message === INVALID_BACK_DATE) {
          bot.replyPrivate(message, 'いまの作業の開始時刻よりも前の時間は設定できないよー');
          return;
        } else {
          throw e;
        }
      }
      currentUpdatePromise = ctDao.upsert(current);
    } else {
      currentUpdatePromise = Promise.resolve();
    }
    currentUpdatePromise.then(result => {
      // 新しいタスクを開始
      const newTask: CurrentTask = {
        startTime: startTime,
        endTime: undefined,
        taskName: command.taskName,
        teamId: message.team_id,
        userId: message.user_id
      };
      ctDao.upsert(newTask).then(result => {
        bot.replyPrivate(message, OK_RESPONSE_TEXT);
        const startTimeString = moment(newTask.startTime.getTime()).format('HH:mm');
        const replySuffix = command.backDate ? 'やってるぞー！' : 'やるぞー！';
        bot.replyPublicDelayed(message, `⏰ (${startTimeString}) <@${message.user_id}>さん: 「 ${command.taskName} 」${replySuffix}`);
      });
    });
  });
}

/**
 * timesコマンドを実行する関数です。
 * @param bot bot
 * @param message message
 */
export const timesTask: TaskFunction = (bot, message) => {
  if (message.text === '') {
    displayCurrentTask(bot, message);
  } else if (message.text === 'clock out') {
    clockOut(bot, message);
  }else {
    startTask(bot, message);
  }
};
