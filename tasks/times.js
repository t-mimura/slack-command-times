const moment = require('moment');

const DB = require('../data-access/data-access-object');
const worksDao = new DB.WorksDAO();

// TODO: ユーザ情報からそのユーザのタイムゾーンを取得したい
const TIME_ZONE = 9 * 60;

const INVALID_BACK_DATE = 'INVALID_BACK_DATE';

/*
 * 引数の hh:mm 形式の文字列でしていされた時刻の直近のDateオブジェクトを取得します。
 * (当日まだ hh:mm が訪れていないときは前日のデータで返します。)
 */
function getLatestDate(hhmm) {
  const splited = hhmm.split(':');
  const hour = Number(splited[0]);
  const minute = Number(splited[1]);
  const target = moment().utcOffset(TIME_ZONE).hour(hour).minute(minute);
  if (target.isAfter(moment())) {
    target.subtract(1, 'days');
  }
  return target.toDate();
}

// 指定した数字[分]まえのDateオブジェクトを取得します。
function getBackDate(diffMinutes) {
  diffMinutes = Number(diffMinutes);
  return new Date(Date.now() - diffMinutes * 60 * 1000);
}

/*
 * work データに対するトランザクション処理を行います。
 * 指定された関数を処理する前後で work データの取得および更新を行います。
 */
function doTransaction(message, action) {
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
 */
function finishCurrentTask(work, backDate) {
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

// コマンドの引数の文字列から、コマンド指示の構成を解析します。
function parseCommand(messageText) {
  let text = messageText.trim();
  let backDate;
  let matched = text.match(/^(.+)\s+back\s+([0-2]?[0-9]:[0-5]?[0-9])$/);
  if (matched) {
    text = matched[1];
    backDate = getLatestDate(matched[2]);
  } else {
    matched = text.match(/^(.+)\s+back\s+([0-9]+)$/);
    if (matched) {
      text = matched[1];
      backDate = getBackDate(matched[2]);
    }
  }

  return {
    text: text,
    backDate: backDate
  };
}

// コマンドの引数からタスクを追加します。
function addTask(message, work) {
  const command = parseCommand(message.text);
  // 現在のタスクを終了
  finishCurrentTask(work, command.backDate);

  const startTime = command.backDate ? command.backDate.getTime() : Date.now();

  // 新しいタスクを開始
  work.currentTask = {
    name: command.text,
    startTime: startTime
  };
  return command;
}

function listupTasksForDisplay(work) {
  const taskNames = Object.keys(work.tasks);
  if (taskNames.length === 0) {
    return '今日はまだ働いてないよ :sleeping:';
  }
  let result = [];
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

function clearTasks(work) {
  work.tasks = {};
  work.currentTask = null;
}

module.exports = (bot, message) => {
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
          bot.replyPublic(message, `⏰ 「 ${command.text} 」やってるぞー！`);
        } else {
          bot.replyPublic(message, `⏰ 「 ${command.text} 」やるぞー！`);
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
