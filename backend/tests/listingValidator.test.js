const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { validateListing } = require('../src/validation/listingValidator');

const validListing = () => ({
  title: 'Wireless Mouse M100',
  description: 'Ergonomic wireless mouse with a USB receiver included.',
  category: 'Electronics',
  price: 499,
  seller: 'test_seller',
});

describe('validateListing', () => {
  it('accepts a valid listing and normalizes values', () => {
    const result = validateListing({
      ...validListing(),
      title: '  Wireless   Mouse  M100 ',
      category: 'electronics',
      price: '499.50',
      tags: [' USB ', 'usb', 'Mouse'],
    });
    assert.equal(result.valid, true);
    assert.equal(result.value.title, 'Wireless Mouse M100');
    assert.equal(result.value.category, 'Electronics');
    assert.equal(result.value.price, 499.5);
    assert.deepEqual(result.value.tags, ['usb', 'mouse']);
    assert.deepEqual(result.value.attributes, {});
  });

  it('rejects a body that is not an object', () => {
    for (const body of [undefined, null, [], 'text', 42]) {
      const result = validateListing(body);
      assert.equal(result.valid, false);
      assert.ok(result.errors.body);
    }
  });

  it('reports every missing required field separately', () => {
    const result = validateListing({});
    assert.equal(result.valid, false);
    for (const field of ['title', 'description', 'category', 'price', 'seller']) {
      assert.ok(result.errors[field], `expected error for ${field}`);
    }
  });

  it('treats whitespace-only strings as missing', () => {
    const result = validateListing({ ...validListing(), title: '     ', seller: '   ' });
    assert.match(result.errors.title, /required/);
    assert.match(result.errors.seller, /required/);
  });

  it('enforces title and description length', () => {
    assert.ok(validateListing({ ...validListing(), title: 'abcd' }).errors.title);
    assert.ok(validateListing({ ...validListing(), title: 'a'.repeat(101) }).errors.title);
    assert.ok(validateListing({ ...validListing(), description: 'too short' }).errors.description);
    assert.ok(validateListing({ ...validListing(), description: 'a'.repeat(5001) }).errors.description);
  });

  it('rejects wrong data types', () => {
    assert.ok(validateListing({ ...validListing(), title: 12345 }).errors.title);
    assert.ok(validateListing({ ...validListing(), price: true }).errors.price);
    assert.ok(validateListing({ ...validListing(), price: [5] }).errors.price);
    assert.ok(validateListing({ ...validListing(), category: ['Electronics'] }).errors.category);
  });

  it('rejects invalid price formats and values', () => {
    for (const price of ['12abc', '-5', 0, '0', -10, '1e3', '0x10', 12.345, 'Infinity', 2000000, '']) {
      const result = validateListing({ ...validListing(), price });
      assert.ok(result.errors.price, `expected price error for ${JSON.stringify(price)}`);
    }
  });

  it('rejects unsupported categories', () => {
    const result = validateListing({ ...validListing(), category: 'Weapons' });
    assert.match(result.errors.category, /must be one of/);
  });

  it('validates tags and attributes', () => {
    assert.ok(validateListing({ ...validListing(), tags: 'not-a-list' }).errors.tags);
    assert.ok(validateListing({ ...validListing(), tags: Array(11).fill('x').map((x, i) => x + i) }).errors.tags);
    assert.ok(validateListing({ ...validListing(), attributes: ['a'] }).errors.attributes);
    assert.ok(validateListing({ ...validListing(), attributes: { size: { nested: true } } }).errors.attributes);
  });
});