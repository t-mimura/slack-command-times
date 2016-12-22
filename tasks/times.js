const moment = require('moment');

const DB = require('../data-access/data-access-object');
const worksDao = new DB.WorksDAO();

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

// 実行中のタスクがあれば現時点の時刻まで作業したとして taskに計上する
function finishCurrentTask(work) {
  const doneTask = work.currentTask;
  if (!doneTask) {
    return;
  }
  const nowTime = Date.now();
  if (!work.tasks[doneTask.name]) {
    work.tasks[doneTask.name] = {
      totalTime: 0
    };
  }
  work.tasks[doneTask.name].totalTime += nowTime - doneTask.startTime;
  work.currentTask = null;
}

function addTask(message, work) {
  // 現在のタスクを終了
  finishCurrentTask(work);

  const nowTime = Date.now();

  // 新しいタスクを開始
  work.currentTask = {
    name: message.text,
    startTime: Date.now()
  };
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
  work.tasks = [];
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
        bot.replyPublic(message, ':question: そのうちヘルプがでるようになるよー');
      }
    } else {
      addTask(message, work);
      bot.replyPublic(message, `⏰ 「 ${message.text} 」やるぞー！`);
    }
  }).catch(reason => {
    console.log(reason);
  });
};
