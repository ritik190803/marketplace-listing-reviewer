const STATUS_LABELS = { PENDING: 'Pending', IN_REVIEW: 'In review', APPROVED: 'Approved', REJECTED: 'Rejected' };
const DECISION_LABELS = { PENDING: 'Awaiting decision', APPROVED: 'Approved', EDITED: 'Edited', REJECTED: 'Rejected' };

export function StatusBadge({ status }) {
  return <span className={`badge status-${status.toLowerCase()}`}>{STATUS_LABELS[status] || status}</span>;
}

export function SeverityBadge({ severity }) {
  return <span className={`badge sev-${severity.toLowerCase()}`}>{severity}</span>;
}

export function DecisionBadge({ decision }) {
  return <span className={`badge decision-${decision.toLowerCase()}`}>{DECISION_LABELS[decision] || decision}</span>;
}