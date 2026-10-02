import { useState } from 'react';
import { ISSUE_LABELS, PLACEHOLDER_PATTERN } from '../constants';
import { SeverityBadge, DecisionBadge } from './Badges';

const TEXT_FIELDS = ['title', 'description'];

export default function FindingCard({ finding, editable, disabled, saving, onDecide }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  const suggestion = finding.suggested_text;
  const hasPlaceholder = Boolean(suggestion) && PLACEHOLDER_PATTERN.test(suggestion);
  const advisory = !TEXT_FIELDS.includes(finding.field);

  const startEdit = () => {
    setDraft(finding.final_text ?? suggestion ?? '');
    setEditing(true);
  };

  const saveEdit = async () => {
    const ok = await onDecide({ decision: 'EDITED', finalText: draft });
    if (ok) setEditing(false);
  };

  return (
    <div className={`finding severity-${finding.severity.toLowerCase()}`}>
      <div className="finding-head">
        <SeverityBadge severity={finding.severity} />
        <span className="tag">{ISSUE_LABELS[finding.issue_type] || finding.issue_type}</span>
        <span className="tag">Policy {finding.policy_section}</span>
        <DecisionBadge decision={finding.decision} />
      </div>

      <p>{finding.explanation}</p>

      {finding.original_excerpt && (
        <p className="small">
          <strong>Original:</strong> <span className="excerpt">“{finding.original_excerpt}”</span>
        </p>
      )}
      <p className="small">
        <strong>Suggestion:</strong>{' '}
        {suggestion ? (
          <span className="suggestion">{suggestion}</span>
        ) : finding.original_excerpt ? (
          <em>Remove this text</em>
        ) : (
          <em>No automatic fix; review manually</em>
        )}
      </p>
      {finding.decision === 'EDITED' && (
        <p className="small">
          <strong>Reviewer’s text:</strong> <span className="suggestion">{finding.final_text}</span>
        </p>
      )}

      {advisory && <p className="muted small">Advisory: changes to {finding.field} are not applied automatically.</p>}
      {editable && hasPlaceholder && finding.decision !== 'EDITED' && (
        <p className="hint">This suggestion contains placeholders like [this]. Use Edit to fill in real details.</p>
      )}

      {editable && !editing && (
        <div className="actions">
          <button
            onClick={() => onDecide({ decision: 'APPROVED' })}
            disabled={disabled || hasPlaceholder}
            className={finding.decision === 'APPROVED' ? 'selected' : ''}
          >
            Approve
          </button>
          <button onClick={startEdit} disabled={disabled} className={finding.decision === 'EDITED' ? 'selected' : ''}>
            Edit
          </button>
          <button
            onClick={() => onDecide({ decision: 'REJECTED' })}
            disabled={disabled}
            className={finding.decision === 'REJECTED' ? 'selected' : ''}
          >
            Reject
          </button>
          {saving && (
            <span className="muted small" role="status">
              Saving…
            </span>
          )}
        </div>
      )}

      {editable && editing && (
        <div className="edit-box">
          <label htmlFor={`edit-${finding.id}`}>Your wording</label>
          <textarea
            id={`edit-${finding.id}`}
            rows={3}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={5000}
          />
          <div className="actions">
            <button className="primary" onClick={saveEdit} disabled={disabled || !draft.trim()}>
              {saving ? 'Saving…' : 'Save edit'}
            </button>
            <button onClick={() => setEditing(false)} disabled={saving}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}