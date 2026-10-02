import { useEffect, useState } from 'react';
import { listingsApi, errorInfo } from '../api';
import { formatPrice, formatDate } from '../constants';
import { StatusBadge } from './Badges';

const FILTERS = [
  { label: 'To review', value: '' },
  { label: 'Approved', value: 'APPROVED' },
  { label: 'Rejected', value: 'REJECTED' },
];

export default function QueueView({ onOpen, onNotice }) {
  const [filter, setFilter] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [state, setState] = useState({ loading: true, error: null, items: [] });
  const [batch, setBatch] = useState(null); // { running, done, total, failures }

  useEffect(() => {
    let cancelled = false; // ignore responses from an outdated filter
    listingsApi
      .queue(filter)
      .then((items) => {
        if (!cancelled) setState({ loading: false, error: null, items });
      })
      .catch((err) => {
        if (!cancelled) setState({ loading: false, error: errorInfo(err).message, items: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [filter, reloadKey]);

  const reload = () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    setReloadKey((k) => k + 1);
  };

  const changeFilter = (value) => {
    if (value === filter) return;
    setState({ loading: true, error: null, items: [] });
    setFilter(value);
  };

  const pending = state.items.filter((l) => l.status === 'PENDING');
  const running = Boolean(batch?.running);

  // Batch processing: analyze pending listings one at a time (respects free-tier rate limits)
  async function analyzeBatch() {
    const targets = pending;
    const failures = [];
    setBatch({ running: true, done: 0, total: targets.length, failures });
    for (const [index, listing] of targets.entries()) {
      try {
        await listingsApi.analyze(listing.id);
      } catch (err) {
        failures.push(`#${listing.id} ${listing.title}: ${errorInfo(err).message}`);
      }
      setBatch({ running: true, done: index + 1, total: targets.length, failures: [...failures] });
    }
    setBatch({ running: false, done: targets.length, total: targets.length, failures });
    onNotice(`Batch analysis finished: ${targets.length - failures.length} of ${targets.length} listing(s) analyzed.`);
    reload();
  }

  return (
    <section>
      <div className="toolbar">
        <div className="tabs" role="tablist" aria-label="Listing status">
          {FILTERS.map((f) => (
            <button
              key={f.label}
              role="tab"
              aria-selected={filter === f.value}
              className={filter === f.value ? 'active' : ''}
              onClick={() => changeFilter(f.value)}
              disabled={running}
            >
              {f.label}
            </button>
          ))}
        </div>
        {filter === '' && pending.length > 0 && (
          <button className="primary" onClick={analyzeBatch} disabled={running}>
            {running ? `Analyzing ${Math.min(batch.done + 1, batch.total)} of ${batch.total}…` : `Analyze all pending (${pending.length})`}
          </button>
        )}
      </div>

      {batch && !batch.running && batch.failures.length > 0 && (
        <div className="alert error" role="alert">
          <strong>Some analyses failed:</strong>
          <ul>
            {batch.failures.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        </div>
      )}

      {state.loading && (
        <p className="loading" role="status">
          Loading listings…
        </p>
      )}

      {!state.loading && state.error && (
        <div className="alert error" role="alert">
          {state.error} <button onClick={reload}>Retry</button>
        </div>
      )}

      {!state.loading && !state.error && state.items.length === 0 && (
        <div className="empty">
          {filter === '' ? 'No listings are waiting for review. Use "New listing" to add one.' : `No ${filter.toLowerCase()} listings yet.`}
        </div>
      )}

      {!state.loading && !state.error && state.items.length > 0 && (
        <ul className="listing-list">
          {state.items.map((l) => (
            <li key={l.id} className="card listing-row">
              <div>
                <div className="row-title">{l.title}</div>
                <div className="muted small">
                  {l.category} · {formatPrice(l.price)} · seller {l.seller} · added {formatDate(l.created_at)}
                </div>
              </div>
              <div className="row-actions">
                <StatusBadge status={l.status} />
                <button onClick={() => onOpen(l.id)} disabled={running}>
                  {l.status === 'PENDING' || l.status === 'IN_REVIEW' ? 'Review' : 'View'}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}