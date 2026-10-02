import { FIELD_LABELS, formatDate } from '../constants';

function describeEvent(event) {
  const d = event.details || {};
  const field = d.field ? FIELD_LABELS[d.field] || d.field : '';
  switch (event.action) {
    case 'CREATED':
      return 'Listing created';
    case 'ANALYSIS_SUCCEEDED':
      return `AI analysis completed: ${d.findingsCount ?? 0} finding(s)${d.droppedCount ? `, ${d.droppedCount} ungrounded finding(s) discarded` : ''}`;
    case 'ANALYSIS_FAILED':
      return `AI analysis failed (${d.errorCode || 'error'})`;
    case 'FINDING_APPROVED':
      return `Approved suggestion on ${field}`;
    case 'FINDING_EDITED':
      return `Edited suggestion on ${field}: “${d.finalText}”`;
    case 'FINDING_REJECTED':
      return `Rejected suggestion on ${field}`;
    case 'LISTING_APPROVED':
      return `Listing approved${d.note ? `: ${d.note}` : ''}`;
    case 'LISTING_REJECTED':
      return `Listing rejected: ${d.reason}`;
    default:
      return event.action;
  }
}

export default function HistoryPanel({ history }) {
  return (
    <div className="card">
      <h3>Review history</h3>
      {history.length === 0 ? (
        <p className="muted">No history yet.</p>
      ) : (
        <ol className="history">
          {history.map((event) => (
            <li key={event.id}>
              <span className="muted small">{formatDate(event.created_at)}</span> <span className="tag">{event.actor}</span>{' '}
              {describeEvent(event)}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}