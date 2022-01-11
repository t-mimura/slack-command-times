import * as express from 'express';

function createRouter(baseUrl: string, scopes: string, secretsClientId: string): any {
  const router = express.Router();

  router.get('/', function(req, res, next) {

    res.render('index', {
      title: 'Timesコマンド - TOP',
      baseUrl: baseUrl
    });
  });
  return router;
}

module.exports = createRouter;
