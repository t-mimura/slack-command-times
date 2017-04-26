import { initialize as initializeDao } from './data-access/data-access-object';
import { start as startRobot } from './robot';

initializeDao().then(result => {
  startRobot();
});
