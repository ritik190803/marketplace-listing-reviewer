const app = require('./app');
const config = require('./config');
const logger = require('./logger');
const { pool } = require('./db/pool');

const server = app.listen(config.port, () => {
  logger.info({ port: config.port, model: config.geminiModel }, 'Server started');
});

function shutdown(signal) {
  logger.info({ signal }, 'Shutting down');
  server.close(() => pool.end().finally(() => process.exit(0)));
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));