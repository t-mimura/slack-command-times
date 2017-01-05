const DataAccess = require('./data-access/data-access-object');
const Robot = require('./robot');

DataAccess.initialize().then(result => {
  Robot.start();
});
