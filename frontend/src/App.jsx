import { useEffect, useState } from 'react';
import QueueView from './components/QueueView';
import ReviewView from './components/ReviewView';
import CreateListingForm from './components/CreateListingForm';
import './App.css';

export default function App() {
  const [view, setView] = useState({ name: 'queue' }); // { name: 'queue' | 'create' | 'review', id? }
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(null), 5000);
    return () => clearTimeout(timer);
  }, [notice]);

  return (
    <div className="app">
      <header className="app-header">
        <h1>Listing Quality Reviewer</h1>
        <nav>
          <button className={view.name === 'queue' ? 'active' : ''} onClick={() => setView({ name: 'queue' })}>
            Review queue
          </button>
          <button className={view.name === 'create' ? 'active' : ''} onClick={() => setView({ name: 'create' })}>
            New listing
          </button>
        </nav>
      </header>

      {notice && (
        <div className="notice" role="status">
          <span>{notice}</span>
          <button className="link" onClick={() => setNotice(null)} aria-label="Dismiss message">
            ✕
          </button>
        </div>
      )}

      <main>
        {view.name === 'queue' && <QueueView onOpen={(id) => setView({ name: 'review', id })} onNotice={setNotice} />}
        {view.name === 'create' && (
          <CreateListingForm
            onCreated={(listing) => {
              setNotice(`Listing "${listing.title}" passed validation and was added to the queue.`);
              setView({ name: 'review', id: listing.id });
            }}
            onCancel={() => setView({ name: 'queue' })}
          />
        )}
        {view.name === 'review' && (
          // key = listing id: switching listings creates a fresh component, so one listing's
          // in-flight response can never be applied to another listing
          <ReviewView key={view.id} listingId={view.id} onBack={() => setView({ name: 'queue' })} onNotice={setNotice} />
        )}
      </main>
    </div>
  );
}