const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { retrievePolicySections } = require('../src/policy/retrievePolicy');

const base = { title: 'Oak Dining Table', description: 'Solid oak table, 180 x 90 cm.', category: 'Home', attributes: {}, tags: [] };
const ids = (listing) => retrievePolicySections(listing).map((s) => s.id);

describe('retrievePolicySections', () => {
  it('always includes core policy and brand-guide sections', () => {
    const result = ids(base);
    for (const id of ['POL-1', 'POL-2', 'POL-4', 'POL-5', 'POL-6', 'POL-7', 'BRD-1', 'BRD-2', 'BRD-3']) {
      assert.ok(result.includes(id), `missing ${id}`);
    }
  });

  it('includes only the matching category section', () => {
    const result = ids(base);
    assert.ok(result.includes('CAT-HOME'));
    assert.ok(!result.includes('CAT-ELEC'));
  });

  it('includes the health section only when health terms appear', () => {
    assert.ok(!ids(base).includes('POL-3'));
    assert.ok(ids({ ...base, description: 'This chair cures back pain instantly.' }).includes('POL-3'));
  });
});