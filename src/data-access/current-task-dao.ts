import * as Datastore from '@google-cloud/datastore';
import { logger } from '../utils/logger';
import DatastoreSetting from './common-setting';

const KIND = DatastoreSetting.KIND.CURRENT_TASK;

const datastore = Datastore({
  keyFilename: DatastoreSetting.GCOUND_API_KEY_FILE_PATH
});

/**
 * 当日中のタスクを表すインターフェースです。
 * 当日中とは前回 `clock out` してから次に `clock out` するまでの間です。
 */
export interface CurrentTask {
  id?: number;
  teamId: string;
  userId: string;
  startTime: Date;
  endTime?: Date;
  taskName: string;
}

/**
 * このファイルが提供している関数群を機能させるための初期化処理を行います。
 * * DB参照のオブジェクトを初期化します。
 * * Indexの設定を行います。
 */
export const initialize = () => {
  return new Promise<Datastore>((resolve, reject) => {
    // いまは非同期にする必要はないが何か特殊処理が増えたときのためにこのままにしておく
    resolve(datastore);
  });
};

/**
 * Promiseでエラー発生時の処理を行います。
 *
 * @param reason エラーの原因
 */
function doErrorProcess(reason: any): any {
  if (reason instanceof Error) {
    logger.exception(reason);
  } else {
    logger.error(reason);
  }
  throw reason;
}

/**
 * 当日中のタスクを取り扱うDataAccessObjectクラスです。
 */
export class CurrentTaskDao {
  /**
   * 該当ユーザのCurrentTaskを全て検索します。
   * @param message 該当ユーザを紐付けるためのmessageオブジェクト
   * @return 検索結果を受け取るPromise
   */
  findAll(message: any): Promise<CurrentTask[]> {
    const query = datastore.createQuery(KIND)
      .filter('teamId', message.team_id)
      .filter('userId', message.user_id);
    return datastore.runQuery(query).then(entities => {
      if (entities.length === 0) {
        return [];
      } else {
        return entities[0];
      }
    }).catch(doErrorProcess);
  }

  /**
   * 該当ユーザの直近の CurrentTask を検索します。
   * @param message 検索条件になるmessageオブジェクト
   * @return 検索結果を受け取るPromise
   */
  findLatest(message: any): Promise<CurrentTask | null> {
    return this.findAll(message).then(tasks => {
      let result: CurrentTask | null = null;
      tasks.forEach(task => {
        if (!task.endTime) {
          result = task;
        }
      });
      return result;
    });
  }

  /**
   * CurrentTaskを追加または更新します。
   * キーに対応するCurrentTaskがまだ永続されていないときは追加を行います。それ以外の時は更新を行います。
   * @param currentTask 追加or更新するCurrentTask
   */
  upsert(currentTask: CurrentTask): Promise<any> {
    const transaction = datastore.transaction();
    return transaction.run().then(() => {
      if (currentTask.id) {
        return datastore.key([KIND, currentTask.id]);
      } else {
        const incompleteKey = datastore.key([KIND]);
        return transaction.allocateIds(incompleteKey, 1).then(results => {
          const key = results[0][0];
          currentTask.id = parseInt(key.id);
          return key;
        });
      }
    }).then(key => {
      transaction.upsert({ key: key, data: currentTask });
      return transaction.commit();
    }).catch(reason => {
      transaction.rollback();
      throw reason;
    }).catch(doErrorProcess);
  }

  /**
   * ユーザ単位で一括で当日のタスクを削除します。
   * @param message 削除するユーザのmessageオブジェクト
   */
  remove(message: any): Promise<any> {
    const transaction = datastore.transaction();
    return transaction.run().then(() => {
      return this.findAll(message).then(tasks => {
        const keys: any[] = [];
        tasks.forEach(task => {
          keys.push(datastore.key([KIND, task.id]));
        });
        return keys;
      });
    }).then(keys => {
      transaction.delete(keys);
      return transaction.commit();
    }).catch(reason => {
      transaction.rollback();
      throw reason;
    }).catch(doErrorProcess);
  }
}
