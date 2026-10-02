const db = require('./pool');
const { recordEvent } = require('./listingsRepo');

async function hasDecidedFindings(listingId) {
  const { rows } = await db.query(
    "SELECT 1 FROM findings WHERE listing_id = $1 AND decision <> 'PENDING' LIMIT 1",
    [listingId]
  );
  return rows.length > 0;
}

async function insertSuccessfulRun(client, listingId, result) {
  const { rows: [run] } = await client.query(
    `INSERT INTO analysis_runs (listing_id, model, status, retrieved_sections, summary, raw_output, latency_ms)
     VALUES ($1, $2, 'SUCCEEDED', $3, $4, $5, $6)
     RETURNING *`,
    [listingId, result.model, result.retrievedSections, result.summary, JSON.stringify(result.rawOutput), result.latencyMs]
  );

  const findings = [];
  for (const f of result.findings) {
    const { rows: [row] } = await client.query(
      `INSERT INTO findings
         (analysis_run_id, listing_id, field, issue_type, severity, policy_section, explanation, original_excerpt, suggested_text)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [run.id, listingId, f.field, f.issue_type, f.severity, f.policy_section, f.explanation,
        f.original_excerpt || null, f.suggested_text || null]
    );
    findings.push(row);
  }
  return { run, findings };
}

async function saveFailedRun(listingId, { model, retrievedSections, errorCode, latencyMs }) {
  await db.withTransaction(async (client) => {
    const { rows: [run] } = await client.query(
      `INSERT INTO analysis_runs (listing_id, model, status, retrieved_sections, error_message, latency_ms)
       VALUES ($1, $2, 'FAILED', $3, $4, $5)
       RETURNING id`,
      [listingId, model, retrievedSections, errorCode, latencyMs]
    );
    await recordEvent(client, {
      listingId,
      action: 'ANALYSIS_FAILED',
      actor: 'ai',
      details: { runId: run.id, model, errorCode },
    });
  });
}

module.exports = { hasDecidedFindings, insertSuccessfulRun, saveFailedRun };