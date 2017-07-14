import * as moment from 'moment';

import { logger } from '../utils/logger';
import { TaskFunction } from './common';
import { CurrentTask, CurrentTaskDao, getCurrentTaskKey } from '../data-access/current-task-dao';
import { DoneTask, DoneTaskDao, getDoneTaskKey } from '../data-access/done-task-dao';

// TODO: ユーザ情報からそのユーザのタイムゾーンを取得したい
const TIME_ZONE = 9 * 60;
/** 不正な作業終了時間を設定した場合のエラー */
const INVALID_BACK_DATE = 'INVALID_BACK_DATE';

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
    if (result) {
      bot.replyPublic(message, `いまは「 ${result.taskName} 」をやっているよー `);
    } else {
      bot.replyPrivate(message, ':question: そのうちヘルプがでるようになるよー');
    }
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
        key: getDoneTaskKey(currentTask.teamId, currentTask.userId, currentTask.startTime),
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
        bot.replyPublic(message, {
          text: 'おつかれさまー :honey_pot:',
          attachments: [{
            text: listups,
            color: '#80EDBF'
          }]
        });
      });
    });
  });
}

/**
 * もしコマンドテキストが形式にそっていれば、ユーザのステータスを更新します。
 * @param bot botオブジェクト
 * @param message メッセージオブジェクト
 * @param text コマンドテキスト
 */
function changeStatus(bot: any, message: any, text: string): void {
  if (!text) {
    return;
  }
  // text がフォーマットに沿っているかどうか
  const matched = text.match(/^(:[^:\s]+:)\s+([^\s].+)$/);
  if (!matched) {
    return;
  }
  const status_emoji = matched[1];
  const status_text = matched[2];
  // accessTokenを取得する
  getAccessToken(bot, message.user_id, accessToken => {
    if (!accessToken) {
      logger.trace('changeStatus', `user(${message.user_id})'s access token was not existed.`)
      return;
    }
    // users.profile.set APIを発行
    const options = {
      token: accessToken,
      user: message.user_id,
      profile: JSON.stringify({ status_emoji, status_text })
    };
    bot.api.users.profile.set(options, (err, result) => {
      if (err) {
        logger.error(['changeStatus: api call', err]);
      }
      logger.trace('onCallbackInChangeStatus', result);
    });
  });
}

/**
 * チームのアクセストークンを取得します。
 * @param bot botオブジェクト
 * @param userId アクセストークンを取得したいユーザID
 * @param cb コールバック関数
 */
function getAccessToken(bot: any, userId: string, cb: (accessToken: string | undefined) => void ): void {
  bot.botkit.storage.users.get(userId, (err, user) => {
    if (err) {
      logger.error(['getAccessToken', 'userid:' + userId, err]);
      cb(undefined);
      return;
    }
    try {
      if (user) {
        cb(user.access_token);
      } else {
        cb(undefined);
      }
    } catch(ex) {
      logger.exception(ex);
    }
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
        key: getCurrentTaskKey(message.team_id, message.user_id, startTime),
        startTime: startTime,
        endTime: undefined,
        taskName: command.taskName,
        teamId: message.team_id,
        userId: message.user_id
      };
      ctDao.upsert(newTask).then(result => {
        if (command.backDate) {
          bot.replyPublic(message, `⏰ 「 ${command.taskName} 」やってるぞー！`);
        } else {
          bot.replyPublic(message, `⏰ 「 ${command.taskName} 」やるぞー！`);
        }
        changeStatus(bot, message, command.taskName);
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
