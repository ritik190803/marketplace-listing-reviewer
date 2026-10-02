const crypto = require('crypto');
const express = require('express');
const cors = require('cors');
const pinoHttp = require('pino-http');
const config = require('./config');
const logger = require('./logger');
const db = require('./db/pool');
const { notFoundHandler, errorHandler } = require('./errors');

const app = express();

app.use(
  pinoHttp({
    logger,
    genReqId: (req, res) => {
      const id = req.headers['x-request-id'] || crypto.randomUUID();
      res.setHeader('x-request-id', id);
      return id;
    },
    // Log only what's useful; no full header dumps
    serializers: {
      req: (req) => ({ id: req.id, method: req.method, url: req.url }),
      res: (res) => ({ statusCode: res.statusCode }),
    },
    // 4xx → warn, 5xx → error, so problems stand out
    customLogLevel: (req, res, err) => {
      if (err || res.statusCode >= 500) return 'error';
      if (res.statusCode >= 400) return 'warn';
      return 'info';
    },
  })
);
app.use(cors({ origin: config.corsOrigins }));
app.use(express.json({ limit: '100kb' }));

app.get('/api/health', async (req, res) => {
  try {
    await db.query('SELECT 1');
    res.json({
      status: 'ok',
      database: 'ok',
      aiConfigured: Boolean(config.geminiApiKey),
      model: config.geminiModel,
    });
  } catch (err) {
    req.log.error({ err }, 'Health check: database unreachable');
    res.status(503).json({ status: 'degraded', database: 'unreachable' });
  }
});

 app.use('/api/listings', require('./routes/listings'));
app.use('/api/listings', require('./routes/review'));
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;