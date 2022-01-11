import * as express from 'express';

function createRouter(baseUrl: string, scopes: string, secretsClientId: string): any {
  const router = express.Router();

  router.get('/', function(req, res, next) {

    res.render('help', {
      title: 'Timesコマンド - ヘルプ',
      baseUrl: baseUrl
    });
  });
  return router;
}

module.exports = createRouter;
