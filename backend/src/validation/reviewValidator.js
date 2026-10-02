const DECISIONS = ['APPROVED', 'EDITED', 'REJECTED'];

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function cleanReviewer(value, errors) {
  if (value === undefined || value === null || value === '') return 'reviewer';
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 50) {
    errors.reviewer = 'Reviewer name must be 1-50 characters.';
    return undefined;
  }
  return value.trim();
}

function optionalText(value, field, max, errors) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' || value.trim().length > max) {
    errors[field] = `${field} must be text of at most ${max} characters.`;
    return undefined;
  }
  return value.trim() || null;
}

function validateDecision(body) {
  if (!isPlainObject(body)) return { valid: false, errors: { body: 'Request body must be a JSON object.' }, value: null };
  const errors = {};
  const decision = typeof body.decision === 'string' ? body.decision.trim().toUpperCase() : undefined;
  if (!DECISIONS.includes(decision)) errors.decision = 'decision must be APPROVED, EDITED or REJECTED.';

  let finalText = null;
  if (decision === 'EDITED') {
    if (typeof body.finalText !== 'string' || !body.finalText.trim()) {
      errors.finalText = 'Edited text is required when the decision is EDITED.';
    } else if (body.finalText.trim().length > 5000) {
      errors.finalText = 'Edited text cannot exceed 5000 characters.';
    } else {
      finalText = body.finalText.trim();
    }
  }
  const reviewer = cleanReviewer(body.reviewer, errors);
  const valid = Object.keys(errors).length === 0;
  return { valid, errors, value: valid ? { decision, finalText, reviewer } : null };
}

function validateApprove(body = {}) {
  if (body === undefined) body = {};
  if (!isPlainObject(body)) return { valid: false, errors: { body: 'Request body must be a JSON object.' }, value: null };
  const errors = {};
  const note = optionalText(body.note, 'note', 500, errors);
  const reviewer = cleanReviewer(body.reviewer, errors);
  const valid = Object.keys(errors).length === 0;
  return { valid, errors, value: valid ? { note, reviewer } : null };
}

function validateReject(body) {
  if (!isPlainObject(body)) return { valid: false, errors: { reason: 'A rejection reason is required.' }, value: null };
  const errors = {};
  let reason;
  if (typeof body.reason !== 'string' || body.reason.trim().length < 3) {
    errors.reason = 'A rejection reason of at least 3 characters is required.';
  } else if (body.reason.trim().length > 500) {
    errors.reason = 'Rejection reason cannot exceed 500 characters.';
  } else {
    reason = body.reason.trim();
  }
  const reviewer = cleanReviewer(body.reviewer, errors);
  const valid = Object.keys(errors).length === 0;
  return { valid, errors, value: valid ? { reason, reviewer } : null };
}

module.exports = { validateDecision, validateApprove, validateReject, DECISIONS };