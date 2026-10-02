require('dotenv').config();

function required(name) {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value.trim();
}

const config = {
  env: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 5000,
  logLevel: process.env.LOG_LEVEL || 'info',
  corsOrigins: (process.env.CORS_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim()),
  databaseUrl: required('DATABASE_URL'),
  // Not required at boot: if missing, /analyze returns 503 instead of crashing the server
  geminiApiKey: (process.env.GEMINI_API_KEY || '').trim(),
  geminiModel: process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite',
  aiTimeoutMs: Number(process.env.AI_TIMEOUT_MS) || 30000,
};

module.exports = config;