const ROWS = [
  ['Title', 'title'],
  ['Description', 'description'],
];

export default function ComparePanel({ comparison, status }) {
  const { original, revised, skippedFindings, advisoryFindingIds } = comparison;

  return (
    <div className="card">
      <h3>Compare versions</h3>
      <p className="muted small">
        {status === 'APPROVED'
          ? 'Revised = the approved version saved at approval time.'
          : 'Revised = the original plus every suggestion you have approved or edited so far.'}
      </p>

      {ROWS.map(([label, key]) => {
        const changed = original[key] !== revised[key];
        return (
          <div key={key}>
            <h4>
              {label} {changed ? <span className="badge changed">Changed</span> : <span className="muted small">(unchanged)</span>}
            </h4>
            <div className="grid-2">
              <div className="compare-box">
                <div className="muted small">Original</div>
                <div className="pre">{original[key]}</div>
              </div>
              <div className={changed ? 'compare-box revised' : 'compare-box'}>
                <div className="muted small">Revised</div>
                <div className="pre">{revised[key]}</div>
              </div>
            </div>
          </div>
        );
      })}

      {skippedFindings.length > 0 && (
        <p className="hint">
          {skippedFindings.length} accepted suggestion(s) could not be applied automatically, for example because another
          suggestion already changed the same text.
        </p>
      )}
      {advisoryFindingIds.length > 0 && (
        <p className="muted small">
          {advisoryFindingIds.length} accepted suggestion(s) concern category, price, attributes or tags and are advisory only.
        </p>
      )}
    </div>
  );
}