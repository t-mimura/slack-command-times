const Datastore = require('nedb');
const WorksDataFilePath = './.times/db/works.db';

let worksDB;

module.exports.initialize = () => {
  return new Promise((resolve, reject) => {
    worksDB = new Datastore({ filename: WorksDataFilePath });
    worksDB.loadDatabase(err => {
      worksDB.ensureIndex({ fieldName: 'key', unique: true }, err => {
        resolve(worksDB);
      });
    });
  });
};

class WorksDAO {
  getKey(teamId, userId) {
    return teamId + '/' + userId;
  }
  find(message) {
    return new Promise((resolve, reject) => {
      const key = this.getKey(message.team_id, message.user_id);
      worksDB.find({ key: key }, (err, result) => {
        if (err) {
          reject(err);
        } else {
          if (result.length === 0) {
            resolve({
              key: key,
              tasks: {},
              currentTask: undefined
            });
          } else {
            resolve(result[0]);
          }
        }
      });
    });
  }
  upsert(work) {
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

module.exports.WorksDAO = WorksDAO;
