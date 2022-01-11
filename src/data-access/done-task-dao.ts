import { Datastore } from '@google-cloud/datastore';
import { SlashCommand } from '@slack/bolt';
import { logger } from '../utils/logger';
import DatastoreSetting from './common-setting';

const KIND = DatastoreSetting.KIND.DONE_TASK;

const datastore = new Datastore({
  keyFilename: DatastoreSetting.GCOUND_API_KEY_FILE_PATH
});

/**
 * clock out済の過去のタスクを表すインターフェースです。
 */
export interface DoneTask {
  id?: string;
  teamId: string;
  userId: string;
  startTime: Date;
  endTime: Date;
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
 * 済タスクを取り扱うDataAccessObjectクラスです。
 */
export class DoneTaskDao {
  /**
   * 該当ユーザのDoneTaskを全て検索します。
   * @param command 該当ユーザを紐付けるための command オブジェクト
   * @return 検索結果を受け取るPromise
   */
  findAll(command: SlashCommand): Promise<DoneTask[]> {
    const query = datastore.createQuery(KIND)
      .filter('teamId', command.team_id)
      .filter('userId', command.user_id);
    return datastore.runQuery(query).then(results => {
      return results[0];
    }).catch(doErrorProcess);
  }

  /**
   * 該当ユーザの DoneTask を期間を指定して検索します。
   * @param command 検索条件になるcommandオブジェクト
   * @param after この日付より後のデータを取得します。
   * @return 検索結果を受け取るPromise
   */
  findAfter(command: SlashCommand, after: Date): Promise<DoneTask[]> {
    const query = datastore.createQuery(KIND)
      .filter('teamId', command.team_id)
      .filter('userId', command.user_id)
      .filter('startTime', '>', after);
    return datastore.runQuery(query).then(results => {
      return results[0];
    }).catch(doErrorProcess);
  }

  /**
   * 済タスクを一括で追加します。
   * @param doneTasks 追加する 済タスク
   * @return 実行結果を受け取るPromise
   */
  addAll(doneTasks: DoneTask[]) {
    const transaction = datastore.transaction();
    return transaction.run().then(() => {
      const incompleteKey = datastore.key([KIND]);
      return transaction.allocateIds(incompleteKey, doneTasks.length).then(results => {
        return results[0];
      });
    }).then(keys => {
      const entities: { key: any, data: any }[] = [];
      doneTasks.forEach((data, i) => {
        const key = keys[i];
        data.id = key.id;
        entities.push({ key, data });
      });
      transaction.upsert(entities);
      return transaction.commit();
    }).catch(reason => {
      transaction.rollback();
      throw reason;
    }).catch(doErrorProcess);
  }
}
