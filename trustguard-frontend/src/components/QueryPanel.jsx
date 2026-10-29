import { useState } from 'react';
import './QueryPanel.css';
import ResultCard from './ResultCard';

const API = 'http://localhost:8000';

function QueryPanel({ hasDocuments, onResult }) {
  const [question, setQuestion] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const [result,   setResult]   = useState(null);

  const EXAMPLES = [
    'What is the recommended dosage?',
    'What is the treatment duration?',
    'Are there any contraindications?',
    'What are the storage requirements?',
  ];

  async function handleAsk(e) {
    e.preventDefault();
    if (!question.trim()) { setError('Please type a question.'); return; }
    if (!hasDocuments)    { setError('Upload documents first.'); return; }

    setLoading(true); setError(''); setResult(null);
    try {
      const res  = await fetch(`${API}/api/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: question.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Query failed.');
      setResult(data);
      onResult(data);
    } catch (err) {
      setError(err.message.includes('fetch') ? 'Cannot reach backend. Is it running on port 8000?' : err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="query-panel">
      {/* Input card */}
      <div className="card query-card">
        <div className="section-title">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          Ask TruthGuard
        </div>

        {!hasDocuments && (
          <div className="alert alert--info">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            Upload documents or load samples on the left before asking a question.
          </div>
        )}

        <form onSubmit={handleAsk} noValidate>
          <div className="form-group">
            <label className="form-label">Your Question</label>
            <textarea
              className="form-textarea query-textarea"
              placeholder="e.g. What is the recommended dosage according to the documents?"
              value={question}
              onChange={e => { setQuestion(e.target.value); setError(''); }}
              rows={3}
              disabled={loading}
            />
          </div>

          {error && (
            <div className="alert alert--error">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              {error}
            </div>
          )}

          <button type="submit" className="btn btn--primary btn--full" disabled={loading || !hasDocuments}>
            {loading ? (
              <><span className="spinner"/> Searching &amp; Verifying…</>
            ) : (
              <>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{width:16,height:16}}>
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/>
                </svg>
                Verify Answer
              </>
            )}
          </button>
        </form>

        {/* Example questions */}
        <div className="query-examples">
          <p className="query-examples-label">Try an example:</p>
          <div className="query-examples-list">
            {EXAMPLES.map(q => (
              <button key={q} className="example-chip" onClick={() => setQuestion(q)} disabled={loading}>
                {q}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Result */}
      {loading && (
        <div className="query-loading">
          <span className="spinner spinner--dark"/>
          <span>Running pipeline: Retriever → Synthesizer → Critic → Resolver…</span>
        </div>
      )}

      {result && !loading && <ResultCard result={result} />}
    </div>
  );
}

export default QueryPanel;
