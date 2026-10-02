const express = require('express');
const { AppError } = require('../errors');
const { validateListing } = require('../validation/listingValidator');
const { parseId, parseStatuses, parseLimit } = require('../validation/params');
const { withTransaction } = require('../db/pool');
const repo = require('../db/listingsRepo');
const config = require('../config');
const analysisRepo = require('../db/analysisRepo');
const { analyzeListing } = require('../ai/analyzeListing');
const review = require('../review/reviewService');
const router = express.Router();

// Create a listing: deterministic validation -> duplicate check (DB) -> store as PENDING
router.post('/', async (req, res) => {
  const { valid, errors, value } = validateListing(req.body);
  if (!valid) {
    throw new AppError(400, 'VALIDATION_FAILED', 'Listing failed validation.', errors);
  }

  let listing;
  try {
    listing = await withTransaction((client) => repo.insertListing(client, value, { actor: 'seller', source: 'api' }));
  } catch (err) {
    if (repo.isDuplicateError(err)) {
      throw new AppError(409, 'DUPLICATE_LISTING', 'Duplicate listing detected.', {
        title: 'This seller already has a listing with this title.',
      });
    }
    throw err;
  }

  req.log.info({ listingId: listing.id, category: listing.category }, 'Listing created');
  res.status(201).json(listing);
});

// Review queue (batch). Default: PENDING + IN_REVIEW. e.g. ?status=APPROVED,REJECTED&limit=20
router.get('/', async (req, res) => {
  const statuses = parseStatuses(req.query.status);
  const limit = parseLimit(req.query.limit);
  const items = await repo.listByStatus(statuses, limit);
  res.json({ items, count: items.length });
});

// Single listing (Phase 4 will add findings + history to this response)
// Full review view: listing + latest analysis + findings + original/revised comparison + history
router.get('/:id', async (req, res) => {
  const id = parseId(req.params.id);
  res.json(await review.getListingDetail(id));
});

// Prevents two simultaneous analyses of the same listing (single server instance; documented limitation)
const analysesInFlight = new Set();

// Run AI analysis: validation of state -> Gemini (outside transaction) -> save run + findings + history
router.post('/:id/analyze', async (req, res) => {
  const id = parseId(req.params.id);

  if (!config.geminiApiKey) {
    throw new AppError(503, 'AI_NOT_CONFIGURED', 'AI analysis is not configured on the server.');
  }

  const listing = await repo.findById(id);
  if (!listing) {
    throw new AppError(404, 'LISTING_NOT_FOUND', `Listing ${id} not found.`);
  }
  if (listing.status === 'APPROVED' || listing.status === 'REJECTED') {
    throw new AppError(409, 'LISTING_ALREADY_DECIDED', `Listing ${id} is already ${listing.status} and cannot be analyzed again.`);
  }
  if (await analysisRepo.hasDecidedFindings(id)) {
    throw new AppError(409, 'REVIEW_IN_PROGRESS', 'A reviewer has already decided findings for this listing; re-analysis would discard those decisions.');
  }
  if (analysesInFlight.has(id)) {
    throw new AppError(409, 'ANALYSIS_IN_PROGRESS', 'Analysis is already running for this listing.');
  }

  analysesInFlight.add(id);
  try {
    let result;
    try {
      result = await analyzeListing(listing, { log: req.log });
    } catch (err) {
      await analysisRepo
        .saveFailedRun(id, {
          model: config.geminiModel,
          retrievedSections: err.retrievedSections || [],
          errorCode: err.code || 'AI_FAILED',
          latencyMs: err.latencyMs ?? null,
        })
        .catch((dbErr) => req.log.error({ err: dbErr, listingId: id }, 'Failed to record failed analysis run'));
      throw err;
    }

    // AI call happens OUTSIDE the transaction; only the fast DB writes are inside it.
    const saved = await withTransaction(async (client) => {
      const update = await client.query(
        `UPDATE listings SET status = 'IN_REVIEW', updated_at = now()
         WHERE id = $1 AND status IN ('PENDING', 'IN_REVIEW')
         RETURNING id`,
        [id]
      );
      if (update.rowCount === 0) {
        throw new AppError(409, 'LISTING_ALREADY_DECIDED', 'The listing was decided while the analysis was running.');
      }
      const { run, findings } = await analysisRepo.insertSuccessfulRun(client, id, result);
      await repo.recordEvent(client, {
        listingId: id,
        action: 'ANALYSIS_SUCCEEDED',
        actor: 'ai',
        details: { runId: run.id, model: run.model, findingsCount: findings.length, droppedCount: result.dropped.length },
      });
      return { run, findings };
    });

    const { raw_output: _rawOutput, ...run } = saved.run; // raw output stays in the DB for audit
    res.status(201).json({
      listingId: id,
      status: 'IN_REVIEW',
      run,
      findings: saved.findings,
      droppedCount: result.dropped.length,
    });
  } finally {
    analysesInFlight.delete(id);
  }
});

module.exports = router;