const pino = require('pino');
const config = require('./config');

const logger = pino({
  level: config.logLevel,
  base: { service: 'listing-reviewer-api', env: config.env },
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: {
    paths: ['req.headers.authorization', 'req.headers.cookie', '*.apiKey', '*.geminiApiKey'],
    censor: '[REDACTED]',
  },
});

module.exports = logger;