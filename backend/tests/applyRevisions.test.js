const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { applyRevisions } = require('../src/review/applyRevisions');

const listing = {
  title: 'Wireless Earbuds Pro X - Best Sound Ever',
  description: 'Brand new earbuds. Doctors recommend these for hearing health. Fully waterproof.',
  category: 'Electronics',
  price: 2499,
  attributes: { brand: 'SoundMax' },
  tags: [],
};

let nextId = 1;
const finding = (overrides) => ({
  id: nextId++,
  field: 'description',
  original_excerpt: null,
  suggested_text: null,
  decision: 'PENDING',
  final_text: null,
  ...overrides,
});

describe('applyRevisions', () => {
  it('applies an APPROVED replacement case-insensitively', () => {
    const { revised, applied } = applyRevisions(listing, [
      finding({ field: 'title', original_excerpt: 'best sound ever', decision: 'APPROVED', final_text: 'Bluetooth 5.3' }),
    ]);
    assert.equal(revised.title, 'Wireless Earbuds Pro X - Bluetooth 5.3');
    assert.equal(applied.length, 1);
  });

  it('uses the reviewer text for EDITED findings', () => {
    const { revised } = applyRevisions(listing, [
      finding({ original_excerpt: 'Fully waterproof.', decision: 'EDITED', final_text: 'IPX4 splash resistant.' }),
    ]);
    assert.match(revised.description, /IPX4 splash resistant\.$/);
  });

  it('ignores REJECTED and PENDING findings', () => {
    const { revised, applied } = applyRevisions(listing, [
      finding({ original_excerpt: 'Fully waterproof.', decision: 'REJECTED', final_text: null }),
      finding({ original_excerpt: 'Brand new earbuds.', decision: 'PENDING' }),
    ]);
    assert.equal(revised.description, listing.description);
    assert.equal(applied.length, 0);
  });

  it('removes the excerpt when the approved suggestion is empty and tidies spacing', () => {
    const { revised } = applyRevisions(listing, [
      finding({ original_excerpt: 'Doctors recommend these for hearing health.', decision: 'APPROVED', final_text: null }),
    ]);
    assert.equal(revised.description, 'Brand new earbuds. Fully waterproof.');
  });

  it('appends text for INCOMPLETE findings without an excerpt', () => {
    const { revised } = applyRevisions(listing, [finding({ decision: 'EDITED', final_text: 'Warranty: 1 year.' })]);
    assert.ok(revised.description.endsWith('Warranty: 1 year.'));
  });

  it('skips findings whose excerpt is no longer present', () => {
    const { skipped } = applyRevisions(listing, [
      finding({ original_excerpt: 'Fully waterproof.', decision: 'APPROVED', final_text: 'Water resistant.' }),
      finding({ original_excerpt: 'Fully waterproof.', decision: 'APPROVED', final_text: 'IPX4.' }),
    ]);
    assert.equal(skipped.length, 1);
    assert.equal(skipped[0].reason, 'EXCERPT_NOT_FOUND');
  });

  it('treats non-text fields as advisory', () => {
    const { advisory, revised } = applyRevisions(listing, [finding({ field: 'price', decision: 'APPROVED', final_text: '1999' })]);
    assert.equal(advisory.length, 1);
    assert.equal(revised.price, 2499);
  });

  it('flags unresolved placeholders', () => {
    const { hasPlaceholders } = applyRevisions(listing, [
      finding({ decision: 'EDITED', final_text: 'Warranty: [warranty period].' }),
    ]);
    assert.equal(hasPlaceholders, true);
  });

  it('never mutates the original listing', () => {
    const copy = JSON.parse(JSON.stringify(listing));
    applyRevisions(listing, [finding({ field: 'title', original_excerpt: 'Best Sound Ever', decision: 'APPROVED', final_text: 'X' })]);
    assert.deepEqual(listing, copy);
  });

  it('cleans up punctuation and separators left behind by removals', () => {
    const { revised } = applyRevisions(
      { ...listing, description: 'Great battery. Better than AirPods. Fully waterproof.' },
      [
        finding({ field: 'title', original_excerpt: 'Best Sound Ever', decision: 'APPROVED', final_text: null }),
        finding({ original_excerpt: 'Better than AirPods', decision: 'APPROVED', final_text: null }),
      ]
    );
    assert.equal(revised.title, 'Wireless Earbuds Pro X');
    assert.equal(revised.description, 'Great battery. Fully waterproof.');
  });
});