import * as request from 'request';
import * as express from 'express';

function createRouter(baseUrl: string, scopes: string, secretsClientId: string): any {
  const router = express.Router();

  router.get('/', function(req, res, next) {

    res.render('times/help', {
      title: 'Timesコマンド - ヘルプ',
      baseUrl: baseUrl,
      scopes: scopes,
      secrets_clientId: secretsClientId });
  });
  return router;
}

module.exports = createRouter;
