import * as Datastore from 'nedb';
const DbFilePath = './.times/db/done-task.db';

/** DBへのインスタンス */
let doneTaskDB: Datastore;

/**
 * clock out済の過去のタスクを表すインターフェースです。
 */
export interface DoneTask {
  key: string;
  teamId: string;
  userId: string;
  startTime: Date;
  endTime: Date;
  taskName: string;
}

/**
 * 済タスクのためのキーを取得します。
 * @param teamId SlackのチームID
 * @param userId SlackのユーザID
 * @param startTime タスクを開始した時間
 * @return キー
 */
export function getDoneTaskKey(
  teamId: string,
  userId: string,
  startTime: Date
): string {
  return teamId + '\t' + userId + '\t' +  startTime.toJSON();
}

/**
 * このファイルが提供している関数群を機能させるための初期化処理を行います。
 * * DB参照のオブジェクトを初期化します。
 * * Indexの設定を行います。
 */
export const initialize = () => {
  return new Promise<Datastore>((resolve, reject) => {
    doneTaskDB = new Datastore({ filename: DbFilePath });
    doneTaskDB.loadDatabase(err => {
      doneTaskDB.ensureIndex({ fieldName: 'key', unique: true }, err => {
        resolve(doneTaskDB);
      });
    });
  });
};

/**
 * 済タスクを取り扱うDataAccessObjectクラスです。
 */
export class DoneTaskDao {
  /**
   * DoneTaskを任意の検索条件で取得します。
   * @param searchCondition 検索条件
   * @param doPostProcess 取得したデータを加工するための関数
   * @return 検索結果を受け取るPromise
   * @type T
   */
  private find<T>(
    searchCondition: { [key: string]: any},
    doPostProcess: (result: DoneTask[]) => T)
  {
    return new Promise<T>((resolve, reject) => {
      doneTaskDB.find(searchCondition, (err, result: DoneTask[]) => {
        if (err) {
          reject(err);
        } else {
          const resolvedValue = doPostProcess(result);
          resolve(resolvedValue);
        }
      });
    });
  }
  /**
   * 該当ユーザのDoneTaskを全て検索します。
   * @param message 該当ユーザを紐付けるためのmessageオブジェクト
   * @return 検索結果を受け取るPromise
   */
  findAll(message: any): Promise<DoneTask[]> {
    return this.find<DoneTask[]>({
      teamId: message.team_id,
      userId: message.user_id
    }, (result: DoneTask[]) => {
      return result;
    });
  }
  /**
   * 該当ユーザの DoneTask を期間を指定して検索します。
   * @param message 検索条件になるmessageオブジェクト
   * @param after
   * @return 検索結果を受け取るPromise
   */
  findAfter(message: any, after: Date): Promise<DoneTask[]> {
    return this.find<DoneTask[]>({
      teamId: message.team_id,
      userId: message.user_id,
      startTime: { $gt: after }
    }, (result: DoneTask[]) => {
      return result;
    });
  }
  /**
   * 済タスクを一括で追加します。
   * @param doneTasks 追加する 済タスク
   * @return 実行結果を受け取るPromise
   */
  addAll(doneTasks: DoneTask[]) {
    return new Promise((resolve, reject) => {
      doneTaskDB.insert(doneTasks, (err, newDocs) => {
        if (err) {
          reject(err);
        } else {
          resolve(newDocs);
        }
      });
    });
  }
}
