import { useState, useEffect } from 'react';
import './GeminiSetup.css';

const API = 'http://localhost:8000';

function GeminiSetup({ onStatusChange }) {
  const [apiKey,  setApiKey]  = useState('');
  const [loading, setLoading] = useState(false);
  const [status,  setStatus]  = useState(null);
  const [message, setMessage] = useState('');
  const [show,    setShow]    = useState(false);

  useEffect(() => {
    fetch(`${API}/api/config/status`)
      .then(r => r.json())
      .then(d => {
        if (d.gemini_configured) {
          setStatus('connected');
          onStatusChange && onStatusChange(true);
        }
      })
      .catch(() => {});
  }, []);

  async function handleConnect(e) {
    e.preventDefault();
    if (!apiKey.trim()) return;
    setLoading(true);
    setMessage('');
    try {
      const res  = await fetch(`${API}/api/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: apiKey.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Connection failed.');
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
      <div className="gemini-inner">

        {/* Left: icon + label */}
        <div className="gemini-left">
          <div className={`gemini-dot ${status === 'connected' ? 'gemini-dot--on' : 'gemini-dot--off'}`}>
            <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
              <path d="M12 2L9.5 9.5 2 12l7.5 2.5L12 22l2.5-7.5L22 12l-7.5-2.5L12 2z"/>
            </svg>
          </div>
          <span className="gemini-label">
            {status === 'connected' ? '✨ Gemini 1.5 Flash — AI Powered' : 'Gemini AI — Not Connected'}
          </span>
        </div>

        {/* Right: button or badge */}
        <div className="gemini-right">
          {status === 'connected' ? (
            <span className="badge badge--green">✓ AI Active</span>
          ) : (
            <button className="btn btn--primary btn--sm" onClick={() => setShow(s => !s)}>
              Connect Gemini
            </button>
          )}
        </div>
      </div>

      {/* Dropdown */}
      {show && status !== 'connected' && (
        <div className="gemini-dropdown-wrap">
          <div className="gemini-dropdown">
            <p className="gemini-dropdown-title">🔑 Enter your Gemini API Key</p>
            <p className="gemini-dropdown-hint">
              Get it FREE → <a href="https://aistudio.google.com" target="_blank" rel="noreferrer">aistudio.google.com</a> → Create API Key
            </p>
            <form onSubmit={handleConnect}>
              <input
                className="form-input"
                type="password"
                placeholder="Paste your API key here (AIza...)"
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                disabled={loading}
                autoFocus
                style={{ marginBottom: 10 }}
              />
              {status === 'error' && (
                <div className="alert alert--error" style={{ marginBottom: 10 }}>
                  ❌ {message}
                </div>
              )}
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="submit" className="btn btn--primary btn--sm" disabled={loading || !apiKey.trim()}>
                  {loading ? 'Connecting…' : 'Connect'}
                </button>
                <button type="button" className="btn btn--secondary btn--sm" onClick={() => setShow(false)}>
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

export default GeminiSetup;
