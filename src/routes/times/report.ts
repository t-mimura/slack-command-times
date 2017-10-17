import * as request from 'request';
import * as express from 'express';
import * as moment from 'moment';

import { InteractiveContext, InteractiveContextManager } from '../../utils/interactive-message-utils';
import { DoneTask, DoneTaskDao } from '../../data-access/done-task-dao';

import { EmojiTool } from '../../utils/emoji-utils';

/**
 * 現在のシステム時刻から半年前のDateオブジェクトを取得します。
 *
 * @return 半年前のDateオブジェクト
 */
function getHalfYearAgo(): Date {
  const rv = new Date();
  rv.setDate(rv.getDate() - 183);
  return rv;
}

/**
 * 現在のシステム時刻から1ヵ月前(30日前)のDateオブジェクトを取得します。
 *
 * @return 1ヵ月(30日)前のDateオブジェクト
 */
function getOneMonthAgo(): Date {
  const rv = new Date();
  rv.setDate(rv.getDate() - 30);
  return rv;
}

/**
 * 現在のシステム時刻から1週前のDateオブジェクトを取得します。
 *
 * @return 1週前のDateオブジェクト
 */
function getOneWeekAgo(): Date {
  const rv = new Date();
  rv.setDate(rv.getDate() - 7);
  return rv;
}

/**
 * 時刻の部分を0でリセットします。
 *
 * @param date 時刻部分を0埋めしたいDateオブジェクト(このオブジェクト自身が変更されます)
 * @return リセットしたDateオブジェクト
 */
function resetTime(date: Date): Date {
  date.setHours(0, 0, 0, 0);
  return date;
}

/**
 * 集計後の完了タスクを表す型定義です。
 */
type SummarizedDoneTask = {
  taskName: string;
  totalTime: number;
  rate: number;
}

/**
 * 表示用にタスクを集計します。
 * 集計期間が指定可能で、startDateで開始日付を指定します。
 * 終了期間は指定不可で直近までが集計期間になります。
 *
 * @param doneTasks 集計したい終了タスクの配列
 * @param startDate 集計期間の開始日付
 * @return 集計結果
 */
function summarize(doneTasks: DoneTask[], startDate: Date): SummarizedDoneTask[] {
  let wholeTotal = 0;
  const totalPerTaskName: { [key: string]: number } = {};
  doneTasks.forEach(doneTask => {
    // 開始日付が集計対象より前の場合は含めない
    if (doneTask.startTime.getTime() < startDate.getTime()) {
      return;
    }
    const total = totalPerTaskName[doneTask.taskName] || 0;
    const diff = doneTask.endTime.getTime() - doneTask.startTime.getTime();
    wholeTotal += diff;
    totalPerTaskName[doneTask.taskName] = total + diff;
  });
  let result: SummarizedDoneTask[] = [];
  const taskNames = Object.keys(totalPerTaskName);
  taskNames.forEach(taskName => {
    const totalTime = totalPerTaskName[taskName];
    result.push({
      taskName: taskName,
      totalTime: totalTime,
      rate: Math.floor(totalTime / wholeTotal * 100)
    });
  });
  // taskNameでソート
  result = result.sort((arg1, arg2) => {
    return arg1.taskName.localeCompare(arg2.taskName);
  });
  return result;
}

/**
 * タスク名を絵文字対応に変換します。
 *
 * @param tasks 絵文字対応に変換したいタスクリスト
 * @param emojiTool Emojiツール
 * @return 絵文字対応したタスクリスト
 */
function emojify(tasks: SummarizedDoneTask[], emojiTool: EmojiTool): SummarizedDoneTask[] {
  tasks.forEach(task => {
    task.taskName = emojiTool.emojify(task.taskName);
  });
  return tasks;
}

function createRouter(baseUrl: string): any {
  const router = express.Router();

  router.get('/:id', function(req, res, next) {
    const id = req.params.id;
    if (id) {
      const context = InteractiveContextManager.getInstance().getContext(id);
      if (!context) {
        res.render('times/report', { title: 'Timesコマンド - 集計', baseUrl: baseUrl,
            errorMessage: '指定のURLは現在有効ではありません。' });
        return;
      }
      const dtDao = new DoneTaskDao();
      dtDao.findAfter(context.message, resetTime(getHalfYearAgo())).then(result => {
        const emojiTool: EmojiTool = new EmojiTool();
        emojiTool.initialize().then(() => {
          const lastWeekData = emojify(summarize(result, resetTime(getOneWeekAgo())), emojiTool);
          const lastMonthData = emojify(summarize(result, resetTime(getOneMonthAgo())), emojiTool);
          const lastHalfYearData = emojify(summarize(result, resetTime(getHalfYearAgo())), emojiTool);
          res.render('times/report', { title: 'Timesコマンド - 集計', baseUrl: baseUrl,
              lastWeek: lastWeekData, lastMonth: lastMonthData, lastHalfYear: lastHalfYearData });
        }).catch(reason => {
          res.render('times/report', { title: 'Timesコマンド - 集計', baseUrl: baseUrl,
              errorMessage: '内部エラーが発生しました。' });
        });
      }).catch(reason => {
        res.render('times/report', { title: 'Timesコマンド - 集計', baseUrl: baseUrl,
             errorMessage: '内部エラーが発生しました。' });
      });
    } else {
      res.render('times/report', { title: 'Timesコマンド - 集計', baseUrl: baseUrl,
          errorMessage: 'URLの指定が間違っています。' });
    }
  });
  return router;
}

module.exports = createRouter;
