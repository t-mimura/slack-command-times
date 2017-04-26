import * as Datastore from 'nedb';
const WorksDataFilePath = './.times/db/works.db';

let worksDB: Datastore;

export interface DoneTask {
  totalTime: number;
}
export interface CurrentTask {
  name: string;
  startTime: number;
}
export interface Work {
  key: string;
  tasks: { [key: string]: DoneTask };
  currentTask: CurrentTask | undefined | null;
}

export const initialize = () => {
  return new Promise<Datastore>((resolve, reject) => {
    worksDB = new Datastore({ filename: WorksDataFilePath });
    worksDB.loadDatabase(err => {
      worksDB.ensureIndex({ fieldName: 'key', unique: true }, err => {
        resolve(worksDB);
      });
    });
  });
};

export class WorksDAO {
  getKey(teamId: string, userId: string): string {
    return teamId + '/' + userId;
  }
  find(message: any): Promise<Work> {
    return new Promise<Work>((resolve, reject) => {
      const key = this.getKey(message.team_id, message.user_id);
      worksDB.find({ key: key }, (err, result: Work[]) => {
        if (err) {
          reject(err);
        } else {
          if (result.length === 0) {
            const empty: Work = {
              key: key,
              tasks: {},
              currentTask: undefined
            };
            resolve(empty);
          } else {
            resolve(result[0]);
          }
        }
      });
    });
  }
  upsert(work: Work): Promise<any> {
    return new Promise((resolve, reject) => {
      worksDB.update({ key: work.key }, work, { upsert: true }, (err, numReplaced) => {
        if (err) {
          reject(err);
        } else {
          resolve(numReplaced);
        }
      });
    });
  }
}
