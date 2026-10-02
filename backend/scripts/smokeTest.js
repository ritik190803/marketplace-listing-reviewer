// End-to-end smoke test of the full review workflow against a running API.
// Usage: npm run smoke                      (local)
//        npm run smoke -- https://your-api  (deployed)
// Creates its own listings (seller "smoke_test") and uses one Gemini request.

const BASE = (process.argv[2] || 'http://localhost:5000').replace(/\/$/, '');
let failures = 0;

function check(name, condition, info) {
  console.log(`${condition ? 'PASS' : 'FAIL'}  ${name}`);
  if (!condition) {
    failures += 1;
    if (info !== undefined) console.log('      ', JSON.stringify(info).slice(0, 500));
  }
}

async function call(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    // non-JSON response; leave data null
  }
  return { status: res.status, data };
}

function finish() {
  console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`);
  process.exit(failures === 0 ? 0 : 1);
}

(async () => {
  console.log(`Smoke test against ${BASE}\n`);

  // Health
  const health = await call('GET', '/api/health');
  check('health: database ok', health.status === 200 && health.data?.database === 'ok', health.data);
  check('health: AI configured', health.data?.aiConfigured === true, health.data);

  // Deterministic validation
  const stamp = Date.now();
  const listingBody = {
    title: `Smoke Test Speaker ${stamp}`,
    description:
      'Portable bluetooth speaker with USB-C charging and a fabric finish. Best speaker in the world, 100% guaranteed to impress.',
    category: 'Electronics',
    price: 1999,
    seller: 'smoke_test',
    attributes: { brand: 'TestBrand', condition: 'New' },
  };

  const invalid = await call('POST', '/api/listings', { title: 'abc', price: '12abc' });
  check('create: invalid listing -> 400 with field errors', invalid.status === 400 && Boolean(invalid.data?.error?.details?.price), invalid.data);

  const created = await call('POST', '/api/listings', listingBody);
  check('create: valid listing -> 201 PENDING', created.status === 201 && created.data?.status === 'PENDING', created.data);
  if (created.status !== 201) return finish();
  const id = created.data.id;

  const duplicate = await call('POST', '/api/listings', listingBody);
  check('create: duplicate -> 409', duplicate.status === 409, duplicate.data);

  const other = await call('POST', '/api/listings', { ...listingBody, title: `Smoke Test Reject ${stamp}` });
  check('create: second listing -> 201', other.status === 201, other.data);
  const otherId = other.data?.id;

  // State rules before analysis
  const early = await call('POST', `/api/listings/${id}/approve`);
  check('approve before analysis -> 409', early.status === 409, early.data);

  // AI analysis
  console.log('\nRunning AI analysis (about 10s)...');
  const analysis = await call('POST', `/api/listings/${id}/analyze`);
  check('analyze -> 201 IN_REVIEW', analysis.status === 201 && analysis.data?.status === 'IN_REVIEW', analysis.data);
  if (analysis.status !== 201) return finish();
  const findings = analysis.data.findings;
  console.log(`      ${findings.length} finding(s): ${findings.map((f) => `${f.policy_section}/${f.severity}`).join(', ') || 'none'}\n`);

  if (findings.length > 0) {
    const blocked = await call('POST', `/api/listings/${id}/approve`);
    check('approve with undecided findings -> 422', blocked.status === 422, blocked.data);

    const wrong = await call('POST', `/api/listings/${otherId}/findings/${findings[0].id}/decision`, { decision: 'APPROVED' });
    check('decision through the wrong listing id is refused', wrong.status === 404 || wrong.status === 409, wrong.data);
  }

  // Human decisions: first REJECTED, placeholders EDITED, the rest APPROVED
  for (const [index, f] of findings.entries()) {
    const hasPlaceholder = Boolean(f.suggested_text) && /\[[^\]]+\]/.test(f.suggested_text);
    const body =
      index === 0
        ? { decision: 'REJECTED' }
        : hasPlaceholder
          ? { decision: 'EDITED', finalText: f.suggested_text.replace(/\[[^\]]+\]/g, 'not specified') }
          : { decision: 'APPROVED' };
    const res = await call('POST', `/api/listings/${id}/findings/${f.id}/decision`, body);
    check(`finding ${f.id} (${f.policy_section}): ${body.decision}`, res.status === 200, res.data);
  }

  // Compare original vs revised
  const detail = await call('GET', `/api/listings/${id}`);
  check('detail: ready to approve', detail.data?.review?.canApprove === true, detail.data?.review);
  console.log(`      original: ${detail.data?.comparison?.original?.description}`);
  console.log(`      revised : ${detail.data?.comparison?.revised?.description}\n`);

  // Final approval + locking
  const approved = await call('POST', `/api/listings/${id}/approve`, { note: 'Smoke test approval' });
  check(
    'approve -> 200 APPROVED with saved revised version',
    approved.status === 200 && approved.data?.listing?.status === 'APPROVED' && Boolean(approved.data?.listing?.final_content),
    approved.data
  );
  const again = await call('POST', `/api/listings/${id}/approve`);
  check('approve again -> 409', again.status === 409, again.data);
  const rejectAfter = await call('POST', `/api/listings/${id}/reject`, { reason: 'should be refused' });
  check('reject after approve -> 409', rejectAfter.status === 409, rejectAfter.data);

  // History
  const actions = (approved.data?.history || []).map((e) => e.action);
  check(
    'history: CREATED, ANALYSIS_SUCCEEDED, LISTING_APPROVED recorded',
    ['CREATED', 'ANALYSIS_SUCCEEDED', 'LISTING_APPROVED'].every((a) => actions.includes(a)),
    actions
  );
  check('history: one event per finding decision', actions.filter((a) => a.startsWith('FINDING_')).length === findings.length, actions);

  // Reject flow
  const noReason = await call('POST', `/api/listings/${otherId}/reject`);
  check('reject without reason -> 400', noReason.status === 400, noReason.data);
  const rejected = await call('POST', `/api/listings/${otherId}/reject`, { reason: 'Smoke test rejection' });
  check('reject -> 200 REJECTED', rejected.status === 200 && rejected.data?.listing?.status === 'REJECTED', rejected.data);

  // Queue no longer shows decided listings
  const queue = await call('GET', '/api/listings');
  check(
    'queue excludes decided listings',
    queue.status === 200 && !queue.data.items.some((l) => l.id === id || l.id === otherId),
    queue.data
  );

  finish();
})().catch((err) => {
  console.error('Smoke test crashed:', err.message);
  process.exit(1);
});