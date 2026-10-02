const express = require('express');
const { AppError } = require('../errors');
const { parseId } = require('../validation/params');
const { validateDecision, validateApprove, validateReject } = require('../validation/reviewValidator');
const review = require('../review/reviewService');

const router = express.Router();

// Approve / edit / reject ONE finding. The finding must belong to the listing in the URL.
router.post('/:id/findings/:findingId/decision', async (req, res) => {
  const id = parseId(req.params.id);
  const findingId = parseId(req.params.findingId, 'Finding id');
  const { valid, errors, value } = validateDecision(req.body);
  if (!valid) throw new AppError(400, 'VALIDATION_FAILED', 'Decision is invalid.', errors);

  const { changed } = await review.decideFinding(id, findingId, value);
  req.log.info(
    { event: 'review.finding_decided', listingId: id, findingId, decision: value.decision, changed, reviewer: value.reviewer },
    'Finding decision saved'
  );
  res.json(await review.getListingDetail(id)); // fresh detail so the UI comparison updates immediately
});

// Final approval of the whole listing (publishes the revised version)
router.post('/:id/approve', async (req, res) => {
  const id = parseId(req.params.id);
  const { valid, errors, value } = validateApprove(req.body);
  if (!valid) throw new AppError(400, 'VALIDATION_FAILED', 'Approval request is invalid.', errors);

  const detail = await review.approveListing(id, value);
  req.log.info({ event: 'review.listing_approved', listingId: id, reviewer: value.reviewer }, 'Listing approved');
  res.json(detail);
});

// Final rejection of the whole listing (reason required)
router.post('/:id/reject', async (req, res) => {
  const id = parseId(req.params.id);
  const { valid, errors, value } = validateReject(req.body);
  if (!valid) throw new AppError(400, 'VALIDATION_FAILED', 'Rejection request is invalid.', errors);

  const detail = await review.rejectListing(id, value);
  req.log.info({ event: 'review.listing_rejected', listingId: id, reviewer: value.reviewer }, 'Listing rejected');
  res.json(detail);
});

module.exports = router;