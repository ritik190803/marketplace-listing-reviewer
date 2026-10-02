const fs = require('fs');
const path = require('path');
const { pool } = require('../src/db/pool');

(async () => {
  const sql = fs.readFileSync(path.join(__dirname, '../src/db/schema.sql'), 'utf8');
  await pool.query(sql);
  console.log('Schema applied successfully.');
  await pool.end();
})().catch(async (err) => {
  console.error('Schema init failed:', err.message);
  await pool.end();
  process.exit(1);
});