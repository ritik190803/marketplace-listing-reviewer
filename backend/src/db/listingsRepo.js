const db = require('./pool');

const DUPLICATE_CONSTRAINT = 'listings_seller_title_unique';

function isDuplicateError(err) {
  return err && err.code === '23505' && err.constraint === DUPLICATE_CONSTRAINT;
}

async function recordEvent(client, { listingId, findingId = null, action, actor = 'reviewer', details = {} }) {
  await client.query(
    `INSERT INTO review_events (listing_id, finding_id, action, actor, details)
     VALUES ($1, $2, $3, $4, $5)`,
    [listingId, findingId, action, actor, JSON.stringify(details)]
  );
}

async function insertListing(client, value, { actor = 'seller', source = 'api' } = {}) {
  const { rows } = await client.query(
    `INSERT INTO listings (title, description, category, price, attributes, seller, tags)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      value.title,
      value.description,
      value.category,
      value.price,
      JSON.stringify(value.attributes),
      value.seller,
      value.tags,
    ]
  );
  const listing = rows[0];
  await recordEvent(client, { listingId: listing.id, action: 'CREATED', actor, details: { source } });
  return listing;
}

async function listByStatus(statuses, limit) {
  const { rows } = await db.query(
    `SELECT * FROM listings
     WHERE status = ANY($1::text[])
     ORDER BY created_at ASC, id ASC
     LIMIT $2`,
    [statuses, limit]
  );
  return rows;
}

async function findById(id) {
  const { rows } = await db.query('SELECT * FROM listings WHERE id = $1', [id]);
  return rows[0] || null;
}

module.exports = { isDuplicateError, recordEvent, insertListing, listByStatus, findById };