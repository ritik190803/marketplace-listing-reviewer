const { AppError } = require('../errors');

const LISTING_STATUSES = ['PENDING', 'IN_REVIEW', 'APPROVED', 'REJECTED'];
const DEFAULT_QUEUE = ['PENDING', 'IN_REVIEW'];

function parseId(raw, name = 'Listing id') {
  if (typeof raw !== 'string' || !/^\d{1,9}$/.test(raw) || Number(raw) < 1) {
    throw new AppError(400, 'INVALID_ID', `${name} must be a positive integer.`);
  }
  return Number(raw);
}

function parseStatuses(raw) {
  if (raw === undefined || raw === '') return DEFAULT_QUEUE;
  if (typeof raw !== 'string') {
    throw new AppError(400, 'INVALID_STATUS', 'Pass statuses as one comma-separated value.');
  }
  const list = [...new Set(raw.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean))];
  const invalid = list.filter((s) => !LISTING_STATUSES.includes(s));
  if (list.length === 0 || invalid.length > 0) {
    throw new AppError(400, 'INVALID_STATUS', `status must be one or more of: ${LISTING_STATUSES.join(', ')}.`);
  }
  return list;
}

function parseLimit(raw, { defaultValue = 20, max = 50 } = {}) {
  if (raw === undefined) return defaultValue;
  if (typeof raw !== 'string' || !/^\d+$/.test(raw) || Number(raw) < 1 || Number(raw) > max) {
    throw new AppError(400, 'INVALID_LIMIT', `limit must be an integer between 1 and ${max}.`);
  }
  return Number(raw);
}

module.exports = { parseId, parseStatuses, parseLimit, LISTING_STATUSES };