const db = require('../db/pool');
const { recordEvent } = require('../db/listingsRepo');
const { AppError } = require('../errors');
const { validateListing } = require('../validation/listingValidator');
const { applyRevisions, PLACEHOLDER_PATTERN } = require('./applyRevisions');

// `q` is anything with .query(): the pool (reads) or a transaction client (writes)
async function getLatestRun(q, listingId) {
  const { rows } = await q.query(
    `SELECT id, listing_id, model, status, retrieved_sections, summary, latency_ms, created_at
     FROM analysis_runs
     WHERE listing_id = $1 AND status = 'SUCCEEDED'
     ORDER BY created_at DESC, id DESC
     LIMIT 1`,
    [listingId]
  );
  return rows[0] || null;
}

async function getRunFindings(q, runId) {
  const { rows } = await q.query('SELECT * FROM findings WHERE analysis_run_id = $1 ORDER BY id', [runId]);
  return rows;
}

async function getHistory(q, listingId) {
  const { rows } = await q.query(
    `SELECT id, finding_id, action, actor, details, created_at
     FROM review_events WHERE listing_id = $1 ORDER BY created_at, id`,
    [listingId]
  );
  return rows;
}

async function lockListing(client, listingId) {
  const { rows } = await client.query('SELECT * FROM listings WHERE id = $1 FOR UPDATE', [listingId]);
  if (!rows[0]) throw new AppError(404, 'LISTING_NOT_FOUND', `Listing ${listingId} not found.`);
  return rows[0];
}

function notInReviewError(listing) {
  if (listing.status === 'PENDING') {
    return new AppError(409, 'ANALYSIS_REQUIRED', 'Run AI analysis on this listing before reviewing findings.');
  }
  return new AppError(409, 'LISTING_ALREADY_DECIDED', `Listing ${listing.id} is already ${listing.status}; it can no longer be changed.`);
}

/** Every reason the listing cannot be approved right now (shared by the detail view and the approve action). */
function approvalBlockers(listing, run, findings, revision) {
  if (listing.status === 'PENDING') return ['Run AI analysis before approving.'];
  if (listing.status !== 'IN_REVIEW') return [`Listing is already ${listing.status}.`];

  const blockers = [];
  if (!run) blockers.push('No successful AI analysis found.');
  const pending = findings.filter((f) => f.decision === 'PENDING').length;
  if (pending > 0) blockers.push(`${pending} finding(s) still need a decision.`);
  if (revision.hasPlaceholders) {
    blockers.push('Revised text still contains placeholders like [dimensions]. Edit the related finding.');
  }
  const check = validateListing({ ...revision.revised, seller: listing.seller });
  if (!check.valid) {
    for (const [field, message] of Object.entries(check.errors)) blockers.push(`Revised ${field}: ${message}`);
  }
  return blockers;
}

function buildDetail(listing, run, findings, history) {
  const revision = applyRevisions(listing, findings);
  const blockers = approvalBlockers(listing, run, findings, revision);
  return {
    listing,
    analysis: run,
    findings,
    comparison: {
      original: {
        title: listing.title,
        description: listing.description,
        category: listing.category,
        price: listing.price,
        attributes: listing.attributes,
        tags: listing.tags,
      },
      revised: listing.status === 'APPROVED' && listing.final_content ? listing.final_content : revision.revised,
      appliedFindingIds: revision.applied,
      skippedFindings: revision.skipped,
      advisoryFindingIds: revision.advisory,
    },
    review: {
      pendingFindings: findings.filter((f) => f.decision === 'PENDING').length,
      canApprove: blockers.length === 0,
      approvalBlockers: blockers,
      canReject: listing.status === 'PENDING' || listing.status === 'IN_REVIEW',
    },
    history,
  };
}

async function getListingDetail(listingId) {
  const { rows } = await db.query('SELECT * FROM listings WHERE id = $1', [listingId]);
  const listing = rows[0];
  if (!listing) throw new AppError(404, 'LISTING_NOT_FOUND', `Listing ${listingId} not found.`);
  const run = await getLatestRun(db, listingId);
  const findings = run ? await getRunFindings(db, run.id) : [];
  const history = await getHistory(db, listingId);
  return buildDetail(listing, run, findings, history);
}

async function decideFinding(listingId, findingId, { decision, finalText, reviewer }) {
  return db.withTransaction(async (client) => {
    const listing = await lockListing(client, listingId);
    if (listing.status !== 'IN_REVIEW') throw notInReviewError(listing);

    const { rows } = await client.query('SELECT * FROM findings WHERE id = $1 AND listing_id = $2', [findingId, listingId]);
    const finding = rows[0];
    if (!finding) {
      throw new AppError(404, 'FINDING_NOT_FOUND', `Finding ${findingId} does not belong to listing ${listingId}.`);
    }
    const run = await getLatestRun(client, listingId);
    if (!run || finding.analysis_run_id !== run.id) {
      throw new AppError(409, 'FINDING_SUPERSEDED', 'This finding belongs to an older analysis run.');
    }

    let text = null;
    if (decision === 'APPROVED') text = finding.suggested_text;
    if (decision === 'EDITED') text = finalText;
    if (text && PLACEHOLDER_PATTERN.test(text)) {
      throw new AppError(422, 'PLACEHOLDER_NEEDS_EDIT', 'The text contains placeholders like [dimensions]. Use Edit and replace them with real details.');
    }

    // Repeated identical click: no change, no duplicate history event
    if (finding.decision === decision && (finding.final_text ?? null) === (text ?? null)) {
      return { changed: false };
    }

    await client.query('UPDATE findings SET decision = $1, final_text = $2, decided_at = now() WHERE id = $3', [
      decision,
      text,
      findingId,
    ]);
    await client.query('UPDATE listings SET updated_at = now() WHERE id = $1', [listingId]);
    await recordEvent(client, {
      listingId,
      findingId,
      action: `FINDING_${decision}`,
      actor: reviewer,
      details: { previousDecision: finding.decision, field: finding.field, finalText: text },
    });
    return { changed: true };
  });
}

async function approveListing(listingId, { note, reviewer }) {
  await db.withTransaction(async (client) => {
    const listing = await lockListing(client, listingId);
    if (listing.status !== 'IN_REVIEW') throw notInReviewError(listing);

    const run = await getLatestRun(client, listingId);
    const findings = run ? await getRunFindings(client, run.id) : [];
    const revision = applyRevisions(listing, findings);
    const blockers = approvalBlockers(listing, run, findings, revision);
    if (blockers.length > 0) {
      throw new AppError(422, 'APPROVAL_BLOCKED', 'Listing cannot be approved yet.', { blockers });
    }

    await client.query(
      `UPDATE listings
       SET status = 'APPROVED', final_content = $1, decision_note = $2, decided_at = now(), updated_at = now()
       WHERE id = $3`,
      [JSON.stringify(revision.revised), note, listingId]
    );
    await recordEvent(client, {
      listingId,
      action: 'LISTING_APPROVED',
      actor: reviewer,
      details: { runId: run.id, appliedFindingIds: revision.applied, skippedFindings: revision.skipped, note },
    });
  });
  return getListingDetail(listingId);
}

async function rejectListing(listingId, { reason, reviewer }) {
  await db.withTransaction(async (client) => {
    const listing = await lockListing(client, listingId);
    if (listing.status !== 'PENDING' && listing.status !== 'IN_REVIEW') throw notInReviewError(listing);

    const run = await getLatestRun(client, listingId);
    await client.query(
      `UPDATE listings
       SET status = 'REJECTED', decision_note = $1, decided_at = now(), updated_at = now()
       WHERE id = $2`,
      [reason, listingId]
    );
    await recordEvent(client, {
      listingId,
      action: 'LISTING_REJECTED',
      actor: reviewer,
      details: { reason, runId: run ? run.id : null },
    });
  });
  return getListingDetail(listingId);
}

module.exports = { getListingDetail, decideFinding, approveListing, rejectListing };