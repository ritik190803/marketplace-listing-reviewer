const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { validateDecision, validateApprove, validateReject } = require('../src/validation/reviewValidator');

describe('review request validation', () => {
  it('requires a known decision', () => {
    assert.ok(validateDecision({}).errors.decision);
    assert.ok(validateDecision({ decision: 'MAYBE' }).errors.decision);
    assert.equal(validateDecision({ decision: 'approved' }).value.decision, 'APPROVED');
  });

  it('requires edited text for EDITED', () => {
    assert.ok(validateDecision({ decision: 'EDITED' }).errors.finalText);
    assert.ok(validateDecision({ decision: 'EDITED', finalText: '   ' }).errors.finalText);
    assert.equal(validateDecision({ decision: 'EDITED', finalText: ' New text ' }).value.finalText, 'New text');
  });

  it('accepts an approval with no body', () => {
    const result = validateApprove(undefined);
    assert.equal(result.valid, true);
    assert.equal(result.value.reviewer, 'reviewer');
  });

  it('requires a rejection reason', () => {
    assert.ok(validateReject(undefined).errors.reason);
    assert.ok(validateReject({ reason: 'no' }).errors.reason);
    assert.equal(validateReject({ reason: 'Counterfeit item' }).valid, true);
  });
});