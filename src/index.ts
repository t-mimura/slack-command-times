import { initialize as initializeCurrentTaskDao } from './data-access/current-task-dao';
import { initialize as initializeDoneTaskDao } from './data-access/done-task-dao';
import { start as startRobot } from './robot';

initializeCurrentTaskDao().then(result => {
  initializeDoneTaskDao().then(result => {
    startRobot();
  });
});
