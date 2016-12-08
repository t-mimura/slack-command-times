const moment = require('moment');

const workPerTeamAndUser = {};

function getWork(message) {
  const key = message.team_id + '/' + message.user_id;
  if (!workPerTeamAndUser[key]) {
    workPerTeamAndUser[key] = {
      tasks: {},
      currentTask: undefined
    };
  }
  return workPerTeamAndUser[key];
}

// 実行中のタスクがあれば現時点の時刻まで作業したとして taskに計上する
function finishCurrentTask(message) {
  const work = getWork(message);
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
  work.currentTask = undefined;
}

function addTask(message) {
  // 現在のタスクを終了
  finishCurrentTask(message);

  const work = getWork(message);
  const nowTime = Date.now();

  // 新しいタスクを開始
  work.currentTask = {
    name: message.text,
    startTime: Date.now()
  };
}

function listupTasksForDisplay(message) {
  const work = getWork(message);
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
  console.log('totalTime: ' + totalTime);
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

function clearTasks(message) {
  const work = getWork(message);
  work.tasks = [];
  work.currentTask = undefined;
}

module.exports = (bot, message) => {
  if (message.text === 'clear') {
    clearTasks(message);
    bot.replyPublic(message, 'なかったことにしたよ');
  }
  if (message.text === 'clock out') {
    finishCurrentTask(message);
    const listups = listupTasksForDisplay(message);
    clearTasks(message);
    bot.replyPublic(message, {
      text: 'おつかれさまー :honey_pot:',
      attachments: [{
        text: listups
      }]
    });
  } else if (message.text === '') {
    const work = getWork(message);
    if (work && work.currentTask) {
      bot.replyPublic(message, `いまは「 ${work.currentTask.name} 」をやっているよー `);
    } else {
      bot.replyPublic(message, ':question: そのうちヘルプがでるようになるよー');
    }
  } else {
    addTask(message);
    bot.replyPublic(message, `⏰ 「 ${message.text} 」やるぞー！`);
  }
};
