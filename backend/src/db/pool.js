const { Pool, types } = require('pg');
const config = require('../config');
const logger = require('../logger');

// pg returns NUMERIC as a string by default; convert price to a JS number
types.setTypeParser(1700, (value) => (value === null ? null : parseFloat(value)));

const pool = new Pool({
  connectionString: config.databaseUrl,
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

pool.on('error', (err) => {
  logger.error({ err }, 'Unexpected PostgreSQL idle client error');
});

async function withTransaction(work) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

module.exports = {
  pool,
  query: (text, params) => pool.query(text, params),
  withTransaction,
};