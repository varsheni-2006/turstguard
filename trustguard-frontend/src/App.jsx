import { useState, useEffect } from 'react';
import Navbar       from './components/Navbar';
import Dashboard    from './components/Dashboard';
import UploadPanel  from './components/UploadPanel';
import DocumentList from './components/DocumentList';
import QueryPanel   from './components/QueryPanel';
import AuditHistory from './components/AuditHistory';

const API = 'http://localhost:8000';

/* ── Inline Gemini Bar (no separate file needed) ── */
function GeminiBar() {
  const [apiKey,  setApiKey]  = useState('');
  const [loading, setLoading] = useState(false);
  const [connected, setConnected] = useState(false);
  const [show,    setShow]    = useState(false);
  const [error,   setError]   = useState('');

  useEffect(() => {
    fetch(`${API}/api/config/status`)
      .then(r => r.json())
      .then(d => { if (d.gemini_configured) setConnected(true); })
      .catch(() => {});
  }, []);

  async function connect(e) {
    e.preventDefault();
    if (!apiKey.trim()) return;
    setLoading(true); setError('');
    try {
      const res  = await fetch(`${API}/api/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: apiKey.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed');
      setConnected(true); setShow(false); setApiKey('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      background: 'linear-gradient(90deg,#0f172a,#1e3a5f)',
      borderBottom: '1px solid rgba(99,179,237,0.25)',
      padding: '10px 24px',
    }}>
      {/* Bar row */}
      <div style={{
        maxWidth: 1200, margin: '0 auto',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        {/* Left */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 30, height: 30, borderRadius: '50%',
            background: connected ? 'rgba(74,222,128,0.15)' : 'rgba(148,163,184,0.15)',
            color: connected ? '#4ade80' : '#94a3b8',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: connected ? '0 0 8px rgba(74,222,128,0.5)' : 'none',
          }}>
            <svg viewBox="0 0 24 24" fill="currentColor" width="15" height="15">
              <path d="M12 2L9.5 9.5 2 12l7.5 2.5L12 22l2.5-7.5L22 12l-7.5-2.5L12 2z"/>
            </svg>
          </div>
          <span style={{ color: 'rgba(255,255,255,0.9)', fontWeight: 600, fontSize: '0.85rem' }}>
            {connected ? '✨ Gemini 1.5 Flash — AI Powered' : 'Gemini AI — Not Connected'}
          </span>
        </div>

        {/* Right */}
        <div>
          {connected ? (
            <span style={{
              background: 'rgba(34,197,94,0.15)', color: '#4ade80',
              border: '1px solid rgba(34,197,94,0.3)',
              borderRadius: 999, padding: '3px 12px',
              fontSize: '0.78rem', fontWeight: 700,
            }}>✓ AI Active</span>
          ) : (
            <button
              onClick={() => setShow(s => !s)}
              style={{
                background: '#2563eb', color: '#fff',
                border: 'none', borderRadius: 8, padding: '7px 16px',
                fontWeight: 600, fontSize: '0.82rem', cursor: 'pointer',
              }}
            >
              🔑 Connect Gemini
            </button>
          )}
        </div>
      </div>

      {/* Dropdown */}
      {show && !connected && (
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', justifyContent: 'flex-end' }}>
          <div style={{
            background: '#fff', border: '1px solid #e2e8f0',
            borderRadius: 12, padding: 18, width: 340,
            boxShadow: '0 8px 32px rgba(0,0,0,0.15)', marginTop: 8,
          }}>
            <p style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: 6, color: '#0d1b3e' }}>
              🔑 Enter your free Gemini API Key
            </p>
            <p style={{ fontSize: '0.78rem', color: '#64748b', marginBottom: 12 }}>
              Get it FREE →{' '}
              <a href="https://aistudio.google.com" target="_blank" rel="noreferrer"
                style={{ color: '#2563eb', textDecoration: 'underline' }}>
                aistudio.google.com
              </a>{' '}→ Create API Key
            </p>
            <form onSubmit={connect}>
              <input
                type="password"
                placeholder="Paste API key here (AIza...)"
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                disabled={loading}
                autoFocus
                style={{
                  width: '100%', padding: '9px 12px',
                  border: '1.5px solid #e2e8f0', borderRadius: 8,
                  fontSize: '0.875rem', marginBottom: 8,
                  boxSizing: 'border-box',
                }}
              />
              {error && (
                <p style={{ color: '#dc2626', fontSize: '0.8rem', marginBottom: 8 }}>❌ {error}</p>
              )}
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="submit" disabled={loading || !apiKey.trim()} style={{
                  background: '#2563eb', color: '#fff', border: 'none',
                  borderRadius: 8, padding: '8px 16px',
                  fontWeight: 600, fontSize: '0.82rem', cursor: 'pointer',
                }}>
                  {loading ? 'Connecting…' : 'Connect'}
                </button>
                <button type="button" onClick={() => setShow(false)} style={{
                  background: '#fff', color: '#334155',
                  border: '1.5px solid #e2e8f0', borderRadius: 8,
                  padding: '8px 16px', fontWeight: 600, fontSize: '0.82rem', cursor: 'pointer',
                }}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Main App ── */
function App() {
  const [documents,    setDocuments]    = useState([]);
  const [auditHistory, setAuditHistory] = useState([]);
  const [stats,        setStats]        = useState({ docs: 0, queries: 0, conflicts: 0, resolved: 0 });

  useEffect(() => { fetchDocuments(); fetchAudit(); }, []);

  useEffect(() => {
    const conflicts = auditHistory.reduce((sum, r) => sum + (r.conflicts_detected || 0), 0);
    const resolved  = auditHistory.filter(r => r.status === 'resolved' || r.status === 'verified').length;
    setStats({ docs: documents.length, queries: auditHistory.length, conflicts, resolved });
  }, [documents, auditHistory]);

  async function fetchDocuments() {
    try {
      const res  = await fetch(`${API}/api/documents`);
      const data = await res.json();
      if (res.ok) setDocuments(data.documents);
    } catch {}
  }

  async function fetchAudit() {
    try {
      const res  = await fetch(`${API}/api/audit`);
      const data = await res.json();
      if (res.ok) setAuditHistory(data.history);
    } catch {}
  }

  function handleDocUploaded(doc) {
    setDocuments(prev => [...prev.filter(d => d.filename !== doc.filename), doc]);
  }

  function handleSamplesLoaded(docs) {
    setDocuments(prev => {
      const map = Object.fromEntries(prev.map(d => [d.filename, d]));
      docs.forEach(d => { map[d.filename] = d; });
      return Object.values(map);
    });
  }

  async function handleDelete(docId) {
    try {
      await fetch(`${API}/api/documents/${docId}`, { method: 'DELETE' });
      setDocuments(prev => prev.filter(d => d.id !== docId));
    } catch {}
  }

  function handleQueryResult(result) {
    setAuditHistory(prev => [{
      id:                result.id,
      question:          result.question,
      status:            result.status,
      conflicts_detected: result.contradictions?.length || 0,
      trusted_source:    result.trusted_source,
      trusted_title:     result.trusted_title,
      answer_preview:    result.answer?.slice(0, 200) || '',
      timestamp:         result.timestamp,
    }, ...prev]);
  }

  return (
    <>
      <Navbar docCount={documents.length} />
      <GeminiBar />

      <main style={{ flex: 1, paddingBottom: 40 }}>
        <div className="container">
          <Dashboard stats={stats} />
          <div className="main-grid">
            <div className="main-left">
              <UploadPanel onUploaded={handleDocUploaded} onSamplesLoaded={handleSamplesLoaded} />
              <DocumentList documents={documents} onDelete={handleDelete} />
            </div>
            <div className="main-right">
              <QueryPanel hasDocuments={documents.length > 0} onResult={handleQueryResult} />
            </div>
          </div>
          <AuditHistory history={auditHistory} />
        </div>
      </main>

      <footer style={{
        background: '#0a1628', color: 'rgba(255,255,255,0.45)',
        textAlign: 'center', padding: '16px 20px', fontSize: '0.8rem',
      }}>
        TruthGuard — Document Verification Platform · Built with FastAPI + React
      </footer>
    </>
  );
}

export default App;
