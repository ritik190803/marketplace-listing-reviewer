import { useEffect, useRef, useState } from 'react';
import { listingsApi, errorInfo } from '../api';
import { FIELD_ORDER, FIELD_LABELS, formatPrice, formatDate } from '../constants';
import { StatusBadge } from './Badges';
import FindingCard from './FindingCard';
import ComparePanel from './ComparePanel';
import HistoryPanel from './HistoryPanel';

export default function ReviewView({ listingId, onBack, onNotice }) {
  const [detail, setDetail] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [busy, setBusy] = useState(null); // 'analyze' | 'approve' | 'reject' | 'finding-<id>'
  const [actionError, setActionError] = useState(null);
  const [approveNote, setApproveNote] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const busyRef = useRef(false); // blocks double clicks before the re-render disables buttons

  useEffect(() => {
    let cancelled = false;
    listingsApi
      .detail(listingId)
      .then((d) => {
        if (!cancelled) setDetail(d);
      })
      .catch((err) => {
        if (!cancelled) setLoadError(errorInfo(err).message);
      });
    return () => {
      cancelled = true;
    };
  }, [listingId, reloadKey]);

  // Runs one action at a time; the server response is the new source of truth
  async function runAction(key, action, successMessage) {
    if (busyRef.current) return false;
    busyRef.current = true;
    setBusy(key);
    setActionError(null);
    try {
      const next = await action();
      setDetail(next);
      if (successMessage) onNotice(successMessage);
      return true;
    } catch (err) {
      setActionError(errorInfo(err));
      return false;
    } finally {
      busyRef.current = false;
      setBusy(null);
    }
  }

  if (loadError) {
    return (
      <section>
        <button className="link" onClick={onBack}>
          ← Back to queue
        </button>
        <div className="alert error" role="alert">
          {loadError}{' '}
          <button
            onClick={() => {
              setLoadError(null);
              setReloadKey((k) => k + 1);
            }}
          >
            Retry
          </button>
        </div>
      </section>
    );
  }

  if (!detail) {
    return (
      <p className="loading" role="status">
        Loading listing…
      </p>
    );
  }

  const { listing, analysis, findings, comparison, review, history } = detail;
  const isOpen = listing.status === 'PENDING' || listing.status === 'IN_REVIEW';
  const canDecideFindings = listing.status === 'IN_REVIEW';
  const canAnalyze =
    listing.status === 'PENDING' || (listing.status === 'IN_REVIEW' && findings.every((f) => f.decision === 'PENDING'));
  const grouped = FIELD_ORDER.map((field) => ({ field, items: findings.filter((f) => f.field === field) })).filter(
    (g) => g.items.length > 0
  );

  const analyze = () =>
    runAction(
      'analyze',
      async () => {
        await listingsApi.analyze(listingId);
        return listingsApi.detail(listingId);
      },
      'AI analysis complete. Review each suggestion below.'
    );
  const decide = (findingId, body) => runAction(`finding-${findingId}`, () => listingsApi.decide(listingId, findingId, body));
  const approve = () =>
    runAction('approve', () => listingsApi.approve(listingId, { note: approveNote || undefined }), 'Listing approved. The revised version has been saved.');
  const reject = () => runAction('reject', () => listingsApi.reject(listingId, { reason: rejectReason }), 'Listing rejected.');

  return (
    <section>
      <button className="link" onClick={onBack}>
        ← Back to queue
      </button>

      <div className="review-header">
        <h2>{listing.title}</h2>
        <StatusBadge status={listing.status} />
      </div>

      {actionError && (
        <div className="alert error" role="alert">
          <strong>{actionError.message}</strong>
          {Array.isArray(actionError.details?.blockers) && (
            <ul>
              {actionError.details.blockers.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          )}{' '}
          <button className="link" onClick={() => setActionError(null)}>
            Dismiss
          </button>
        </div>
      )}

      <div className="grid-2">
        <div className="card">
          <h3>Original listing</h3>
          <dl className="fields">
            <dt>Title</dt>
            <dd>{listing.title}</dd>
            <dt>Description</dt>
            <dd className="pre">{listing.description}</dd>
            <dt>Category</dt>
            <dd>{listing.category}</dd>
            <dt>Price</dt>
            <dd>{formatPrice(listing.price)}</dd>
            <dt>Attributes</dt>
            <dd>
              {Object.keys(listing.attributes || {}).length > 0 ? (
                Object.entries(listing.attributes).map(([k, v]) => (
                  <div key={k}>
                    {k}: {String(v)}
                  </div>
                ))
              ) : (
                <span className="muted">None</span>
              )}
            </dd>
            <dt>Tags</dt>
            <dd>{listing.tags?.length ? listing.tags.join(', ') : <span className="muted">None</span>}</dd>
            <dt>Seller</dt>
            <dd>{listing.seller}</dd>
          </dl>
        </div>

        <div className="card">
          <h3>AI analysis</h3>
          {busy === 'analyze' ? (
            <p className="loading" role="status">
              Analyzing with AI… this usually takes 10–20 seconds.
            </p>
          ) : analysis ? (
            <>
              <p>{analysis.summary || 'No summary provided.'}</p>
              <p className="muted small">
                Model {analysis.model} · {findings.length} finding(s)
                {analysis.latency_ms != null && ` · ${(analysis.latency_ms / 1000).toFixed(1)}s`} · {formatDate(analysis.created_at)}
              </p>
              <p className="muted small">Policy sections checked: {analysis.retrieved_sections.join(', ')}</p>
            </>
          ) : (
            <p className="muted">Not analyzed yet.</p>
          )}
          {canAnalyze && (
            <button className="primary" onClick={analyze} disabled={Boolean(busy)}>
              {busy === 'analyze' ? 'Analyzing…' : analysis ? 'Re-run AI analysis' : 'Run AI analysis'}
            </button>
          )}
          <p className="muted small">AI suggestions are proposals only. Nothing changes until a reviewer decides.</p>
        </div>
      </div>

      {analysis && (
        <div className="card">
          <h3>
            Suggestions by field{' '}
            {findings.length > 0 && <span className="muted small">({review.pendingFindings} awaiting decision)</span>}
          </h3>
          {findings.length === 0 ? (
            <p className="empty">No issues found. You can approve the listing as it is.</p>
          ) : (
            grouped.map((group) => (
              <div key={group.field}>
                <h4>
                  {FIELD_LABELS[group.field]} <span className="muted small">({group.items.length})</span>
                </h4>
                {group.items.map((f) => (
                  <FindingCard
                    key={f.id}
                    finding={f}
                    editable={canDecideFindings}
                    disabled={Boolean(busy)}
                    saving={busy === `finding-${f.id}`}
                    onDecide={(body) => decide(f.id, body)}
                  />
                ))}
              </div>
            ))
          )}
        </div>
      )}

      {analysis && <ComparePanel comparison={comparison} status={listing.status} />}

      <div className="card">
        <h3>Final decision</h3>
        {isOpen ? (
          <div className="grid-2">
            <div>
              <h4>Approve</h4>
              {review.approvalBlockers.length > 0 && (
                <ul className="blockers">
                  {review.approvalBlockers.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
              )}
              <label htmlFor="approve-note">Note (optional)</label>
              <input
                id="approve-note"
                value={approveNote}
                onChange={(e) => setApproveNote(e.target.value)}
                maxLength={500}
                disabled={!review.canApprove || Boolean(busy)}
              />
              <button className="success" onClick={approve} disabled={!review.canApprove || Boolean(busy)}>
                {busy === 'approve' ? 'Approving…' : 'Approve revised listing'}
              </button>
            </div>
            <div>
              <h4>Reject</h4>
              <label htmlFor="reject-reason">Reason (required)</label>
              <textarea
                id="reject-reason"
                rows={2}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                maxLength={500}
                disabled={Boolean(busy)}
              />
              <button className="danger" onClick={reject} disabled={rejectReason.trim().length < 3 || Boolean(busy)}>
                {busy === 'reject' ? 'Rejecting…' : 'Reject listing'}
              </button>
            </div>
          </div>
        ) : (
          <div>
            <p>
              <StatusBadge status={listing.status} /> on {formatDate(listing.decided_at)}
            </p>
            {listing.decision_note && (
              <p>
                {listing.status === 'REJECTED' ? 'Reason' : 'Note'}: {listing.decision_note}
              </p>
            )}
            <p className="muted small">This decision is final; the listing can no longer be changed.</p>
          </div>
        )}
      </div>

      <HistoryPanel history={history} />
    </section>
  );
}