import { useState, useEffect } from 'react';
import './GeminiSetup.css';

const API = 'http://localhost:8000';

function GeminiSetup({ onStatusChange }) {
  const [apiKey,   setApiKey]   = useState('');
  const [loading,  setLoading]  = useState(false);
  const [status,   setStatus]   = useState(null); // null | 'connected' | 'error'
  const [message,  setMessage]  = useState('');
  const [show,     setShow]     = useState(false);

  // Check on mount if already connected
  useEffect(() => {
    fetch(`${API}/api/config/status`)
      .then(r => r.json())
      .then(d => {
        if (d.gemini_configured) {
          setStatus('connected');
          setMessage(`Gemini 1.5 Flash connected`);
          onStatusChange && onStatusChange(true);
        }
      })
      .catch(() => {});
  }, []);

  async function handleConnect(e) {
    e.preventDefault();
    if (!apiKey.trim()) return;
    setLoading(true); setMessage('');
    try {
      const res  = await fetch(`${API}/api/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: apiKey.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed');
      setStatus('connected');
      setMessage(data.message);
      setShow(false);
      setApiKey('');
      onStatusChange && onStatusChange(true);
    } catch (err) {
      setStatus('error');
      setMessage(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="gemini-bar">
      <div className="container" style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,flexWrap:'wrap',position:'relative'}}>
        <div className="gemini-bar-left">
        {/* Gemini logo sparkle */}
        <div className={`gemini-dot ${status === 'connected' ? 'gemini-dot--on' : 'gemini-dot--off'}`}>
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2L9.5 9.5 2 12l7.5 2.5L12 22l2.5-7.5L22 12l-7.5-2.5L12 2z"/>
          </svg>
        </div>
        <div>
          <span className="gemini-label">
            {status === 'connected' ? 'Gemini 1.5 Flash — AI Powered ✨' : 'Gemini AI — Not Connected'}
          </span>
          {message && <span className="gemini-msg">{message}</span>}
        </div>
      </div>

      <div className="gemini-bar-right">
        {status !== 'connected' && (
          <button className="btn btn--primary btn--sm" onClick={() => setShow(s => !s)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round" style={{width:14,height:14}}>
              <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>
            </svg>
            Connect Gemini
          </button>
        )}
        {status === 'connected' && (
          <span className="badge badge--green">✓ AI Active</span>
        )}
      </div>

      {/* Dropdown input */}
      {show && status !== 'connected' && (
        <div className="gemini-dropdown">
          <p className="gemini-dropdown-title">
            Enter your free Gemini API Key
          </p>
          <p className="gemini-dropdown-hint">
            Get it free at <a href="https://aistudio.google.com" target="_blank" rel="noreferrer">aistudio.google.com</a> → Create API Key
          </p>
          <form onSubmit={handleConnect} className="gemini-form">
            <input
              type="password"
              className="form-input"
              placeholder="AIza..."
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              disabled={loading}
              autoFocus
            />
            {status === 'error' && (
              <div className="alert alert--error" style={{marginTop:8}}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                  strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="8" x2="12" y2="12"/>
                  <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                {message}
              </div>
            )}
            <div className="gemini-form-actions">
              <button type="submit" className="btn btn--primary btn--sm" disabled={loading || !apiKey.trim()}>
                {loading ? <><span className="spinner"/>Connecting…</> : 'Connect'}
              </button>
              <button type="button" className="btn btn--secondary btn--sm" onClick={() => setShow(false)}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
      </div>  {/* end container */}
    </div>
  );
}

export default GeminiSetup;
