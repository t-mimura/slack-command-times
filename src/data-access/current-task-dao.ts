import * as Datastore from 'nedb';
const DbFilePath = './.times/db/current-task.db';

/** DBへのインスタンス */
let currentTaskDB: Datastore;

/**
 * 当日中のタスクを表すインターフェースです。
 * 当日中とは前回 `clock out` してから次に `clock out` するまでの間です。
 */
export interface CurrentTask {
  key: string;
  teamId: string;
  userId: string;
  startTime: Date;
  endTime?: Date;
  taskName: string;
}

/**
 * 当日中のタスクのためのキーを取得します。
 * @param teamId SlackのチームID
 * @param userId SlackのユーザID
 * @param startTime タスクを開始した時間
 * @return キー
 */
export function getCurrentTaskKey(
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
    currentTaskDB = new Datastore({ filename: DbFilePath });
    currentTaskDB.loadDatabase(err => {
      currentTaskDB.ensureIndex({ fieldName: 'key', unique: true }, err => {
        resolve(currentTaskDB);
      });
    });
  });
};

/**
 * 当日中のタスクを取り扱うDataAccessObjectクラスです。
 */
export class CurrentTaskDao {
  /**
   * CurrentTaskを任意の検索条件で取得します。
   * @param searchCondition 検索条件
   * @param doPostProcess 取得したデータを加工するための関数
   * @return 検索結果を受け取るPromise
   * @type T
   */
  private find<T>(
    searchCondition: { [key: string]: any},
    doPostProcess: (result: CurrentTask[]) => T)
  {
    return new Promise<T>((resolve, reject) => {
      currentTaskDB.find(searchCondition, (err, result: CurrentTask[]) => {
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
   * 該当ユーザのCurrentTaskを全て検索します。
   * @param message 該当ユーザを紐付けるためのmessageオブジェクト
   * @return 検索結果を受け取るPromise
   */
  findAll(message: any): Promise<CurrentTask[]> {
    return this.find<CurrentTask[]>({
      teamId: message.team_id,
      userId: message.user_id
    }, (result: CurrentTask[]) => {
      return result;
    });
  }
  /**
   * 該当ユーザの直近の CurrentTask を検索します。
   * @param message 検索条件になるmessageオブジェクト
   * @return 検索結果を受け取るPromise
   */
  findLatest(message: any): Promise<CurrentTask> {
    return this.find<CurrentTask | null>({
      teamId: message.team_id,
      userId: message.user_id,
      endTime: null
    }, (result: CurrentTask[]) => {
      if (result.length === 0) {
        return null;
      } else {
        return result[0];
      }
    });
  }
  /**
   * CurrentTaskを追加または更新します。
   * キーに対応するCurrentTaskがまだ永続されていないときは追加を行います。それ以外の時は更新を行います。
   * @param currentTask 追加or更新するCurrentTask
   */
  upsert(currentTask: CurrentTask): Promise<any> {
    return new Promise((resolve, reject) => {
      currentTaskDB.update({ key: currentTask.key }, currentTask, { upsert: true }, (err, numReplaced) => {
        if (err) {
          reject(err);
        } else {
          resolve(numReplaced);
        }
      });
    });
  }
}
