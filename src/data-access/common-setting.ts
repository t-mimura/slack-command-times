import * as path from 'path';

export default {
  GCOUND_API_KEY_FILE_PATH: path.join(process.cwd(), '.times/gcloud.apikey.json'),
  KIND: {
    CURRENT_TASK: 'CurrentTask',
    DONE_TASK: 'DoneTask'
  }
};
