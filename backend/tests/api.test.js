process.env.DATABASE_URL ||= 'postgresql://test:test@localhost:5432/test';
process.env.LOG_LEVEL = 'silent';

const { describe, it, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../src/app');
const { pool } = require('../src/db/pool');

after(() => pool.end());

describe('API input handling', () => {
  it('returns 400 with field errors for an invalid listing', async () => {
    const res = await request(app).post('/api/listings').send({ title: 'abc', price: -1 });
    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, 'VALIDATION_FAILED');
    assert.ok(res.body.error.details.title);
    assert.ok(res.body.error.details.price);
  });

  it('returns 400 JSON for malformed JSON', async () => {
    const res = await request(app)
      .post('/api/listings')
      .set('Content-Type', 'application/json')
      .send('{"title": ');
    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, 'INVALID_JSON');
  });

  it('returns 400 for a non-numeric listing id', async () => {
    const res = await request(app).get('/api/listings/abc');
    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, 'INVALID_ID');
  });

  it('returns 400 for an unknown status filter', async () => {
    const res = await request(app).get('/api/listings?status=FOO');
    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, 'INVALID_STATUS');
  });

  it('returns JSON 404 for unknown routes', async () => {
    const res = await request(app).get('/api/does-not-exist');
    assert.equal(res.status, 404);
    assert.equal(res.body.error.code, 'ROUTE_NOT_FOUND');
  });
});