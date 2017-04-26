import * as moment from 'moment';

import { TaskFunction } from './common';
import { CurrentTask, DoneTask, Work, WorksDAO } from '../data-access/data-access-object';
const worksDao = new WorksDAO();

// TODO: ユーザ情報からそのユーザのタイムゾーンを取得したい
const TIME_ZONE = 9 * 60;

const INVALID_BACK_DATE = 'INVALID_BACK_DATE';

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

/** DBトランザクション内の処理を表す型定義です。 */
type TransactionalAction = (work: Work) => void;
/*
 * work データに対するトランザクション処理を行います。
 * 指定された関数を処理する前後で work データの取得および更新を行います。
 * @param message message
 * @param action トランザクション内で実行する処理
 * @return トラン座ション処理が終わったことを表すPromise
 */
function doTransaction(message: any, action: TransactionalAction): Promise<never> {
  return new Promise((resolve, reject) => {
    worksDao.find(message).then(work => {
      try {
        action(work);
      } catch(e) {
        console.log(e);
      }
      worksDao.upsert(work).then(() => {
        resolve();
      }).catch(reason => {
        console.log(reason);
      });
    }).catch(reason => {
      console.log(reason);
    });
  });
}

/*
 * 実行中のタスクがあれば現時点の時刻まで作業したとして taskに計上します。
 * backDate が指定されていれば、その時刻に作業が終わっていたとして計上します。
 * backDate が startTime より早い時間の場合は例外が発生します。
 * @param work 現在のWorkオブジェクト
 * @param backDate さかのぼる日付
 */
function finishCurrentTask(work: Work, backDate?: Date): void {
  const doneTask = work.currentTask;
  if (!doneTask) {
    return;
  }
  const endTime = backDate ? backDate.getTime() : Date.now();
  const diffTime = endTime - doneTask.startTime;
  if (diffTime < 0) {
    throw new Error(INVALID_BACK_DATE);
  }
  if (!work.tasks[doneTask.name]) {
    work.tasks[doneTask.name] = {
      totalTime: 0
    };
  }
  work.tasks[doneTask.name].totalTime += diffTime;
  work.currentTask = null;
}

/** 入力されたコマンド文字を解析した結果を表す型定義です。 */
type Command = { taskName: string, backDate: Date };

/**
 * コマンドの引数の文字列から、コマンド指示の構成を解析します。
 * @param messageText ユーザが入力した文字列
 * @return 解析結果
 */
function parseCommand(messageText: string): Command {
  let taskName = messageText.trim();
  let backDate;
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

/**
 * コマンドの引数からタスクを追加します。
 * @param message message
 * @param work タスクを追加するWorkオブジェクト
 * @return 現在のコマンド
 */
function addTask(message: any, work: Work): Command {
  const command = parseCommand(message.text);
  // 現在のタスクを終了
  finishCurrentTask(work, command.backDate);

  const startTime = command.backDate ? command.backDate.getTime() : Date.now();

  // 新しいタスクを開始
  work.currentTask = {
    name: command.taskName,
    startTime: startTime
  };
  return command;
}

/**
 * 表示用にタスクを集計して文字列で取得します。
 * @param work 集計したいWorkオブジェクト
 * @return リストアップした結果の文字列
 */
function listupTasksForDisplay(work: Work): string {
  const taskNames = Object.keys(work.tasks);
  if (taskNames.length === 0) {
    return '今日はまだ働いてないよ :sleeping:';
  }
  let result: string[] = [];
  let totalTime = 0;
  taskNames.forEach(taskName => {
    const task = work.tasks[taskName];
    totalTime += task.totalTime;
  });
  taskNames.forEach(taskName => {
    const task = work.tasks[taskName];
    result.push([
      `"${taskName}"`,
      moment.duration(task.totalTime, 'millisecond').humanize(),
      '(' + Math.floor(task.totalTime / totalTime * 100) + '%)'
    ].join(' '));
  });
  return result.join('\n');
}

/**
 * タスクをクリアします。
 * @param work タスクをクリアしたいWorkオブジェクト
 */
function clearTasks(work: Work): void {
  work.tasks = {};
  work.currentTask = null;
}

/**
 * timesコマンドを実行する関数です。
 * @param bot bot
 * @param message message
 */
export const timesTask: TaskFunction = (bot, message) => {
  doTransaction(message, work => {
    if (message.text === 'clear') {
      clearTasks(work);
      bot.replyPublic(message, 'なかったことにしたよ');
    } else if (message.text === 'clock out') {
      finishCurrentTask(work);
      const listups = listupTasksForDisplay(work);
      clearTasks(work);
      bot.replyPublic(message, {
        text: 'おつかれさまー :honey_pot:',
        attachments: [{
          text: listups,
          color: '#80EDBF'
        }]
      });
    } else if (message.text === '') {
      if (work && work.currentTask) {
        bot.replyPublic(message, `いまは「 ${work.currentTask.name} 」をやっているよー `);
      } else {
        bot.replyPrivate(message, ':question: そのうちヘルプがでるようになるよー');
      }
    } else {
      try {
        const command = addTask(message, work);
        if (command.backDate) {
          bot.replyPublic(message, `⏰ 「 ${command.taskName} 」やってるぞー！`);
        } else {
          bot.replyPublic(message, `⏰ 「 ${command.taskName} 」やるぞー！`);
        }
      } catch(err) {
        if (err.message === INVALID_BACK_DATE) {
          bot.replyPublic(message, 'いまの作業の開始時刻よりも前の時間は設定できないよー');
        } else {
          throw err;
        }
      }
    }
  }).catch(reason => {
    console.log(reason);
  });
};
