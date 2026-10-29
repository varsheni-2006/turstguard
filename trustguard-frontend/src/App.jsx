import { useState, useEffect } from 'react';
import Navbar      from './components/Navbar';
import Dashboard   from './components/Dashboard';
import UploadPanel from './components/UploadPanel';
import DocumentList from './components/DocumentList';
import QueryPanel  from './components/QueryPanel';
import AuditHistory from './components/AuditHistory';

const API = 'http://localhost:8000';

function App() {
  const [documents,    setDocuments]    = useState([]);
  const [auditHistory, setAuditHistory] = useState([]);
  const [stats,        setStats]        = useState({ docs: 0, queries: 0, conflicts: 0, resolved: 0 });

  /* ── Load state on mount ── */
  useEffect(() => {
    fetchDocuments();
    fetchAudit();
  }, []);

  /* ── Sync stats whenever docs or audit change ── */
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
    } catch { /* backend not ready yet */ }
  }

  async function fetchAudit() {
    try {
      const res  = await fetch(`${API}/api/audit`);
      const data = await res.json();
      if (res.ok) setAuditHistory(data.history);
    } catch { /* backend not ready yet */ }
  }

  /* ── Handlers passed to children ── */
  function handleDocUploaded(doc) {
    setDocuments(prev => {
      const filtered = prev.filter(d => d.filename !== doc.filename);
      return [...filtered, doc];
    });
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
    } catch { /* ignore */ }
  }

  function handleQueryResult(result) {
    const entry = {
      id:                result.id,
      question:          result.question,
      status:            result.status,
      conflicts_detected: result.contradictions?.length || 0,
      trusted_source:    result.trusted_source,
      trusted_title:     result.trusted_title,
      answer_preview:    result.answer?.slice(0, 200) || '',
      timestamp:         result.timestamp,
    };
    setAuditHistory(prev => [entry, ...prev]);
  }

  return (
    <>
      <Navbar docCount={documents.length} />

      <main style={{ flex: 1, paddingBottom: 40 }}>
        <div className="container">
          <Dashboard stats={stats} />

          <div className="main-grid">
            {/* Left column */}
            <div className="main-left">
              <UploadPanel
                onUploaded={handleDocUploaded}
                onSamplesLoaded={handleSamplesLoaded}
              />
              <DocumentList
                documents={documents}
                onDelete={handleDelete}
              />
            </div>

            {/* Right column */}
            <div className="main-right">
              <QueryPanel
                hasDocuments={documents.length > 0}
                onResult={handleQueryResult}
              />
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
