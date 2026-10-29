import { useState } from 'react';
import './UploadPanel.css';

const API = 'http://localhost:8000';

const TIER_OPTIONS = [
  { value: 1, label: 'Tier 1 – Highest Authority' },
  { value: 2, label: 'Tier 2 – High Authority' },
  { value: 3, label: 'Tier 3 – Standard' },
  { value: 4, label: 'Tier 4 – Supporting' },
  { value: 5, label: 'Tier 5 – Reference Only' },
];

const EMPTY_META = {
  title: '', version: '', publication_date: '',
  authority_tier: 3, superseded_by: '',
};

function UploadPanel({ onUploaded, onSamplesLoaded }) {
  const [file,      setFile]      = useState(null);
  const [meta,      setMeta]      = useState(EMPTY_META);
  const [loading,   setLoading]   = useState(false);
  const [samplesLoading, setSamplesLoading] = useState(false);
  const [error,     setError]     = useState('');
  const [success,   setSuccess]   = useState('');

  function handleFileChange(e) {
    setFile(e.target.files[0] || null);
    setError('');
    setSuccess('');
  }

  function handleMeta(field, val) {
    setMeta(prev => ({ ...prev, [field]: val }));
  }

  async function handleUpload(e) {
    e.preventDefault();
    if (!file) { setError('Please select a PDF file.'); return; }

    setLoading(true); setError(''); setSuccess('');
    try {
      const fd = new FormData();
      fd.append('file',             file);
      fd.append('title',            meta.title);
      fd.append('version',          meta.version);
      fd.append('publication_date', meta.publication_date);
      fd.append('authority_tier',   meta.authority_tier);
      fd.append('superseded_by',    meta.superseded_by);

      const res = await fetch(`${API}/api/documents`, { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Upload failed.');

      setSuccess(`"${data.document.filename}" uploaded successfully.`);
      setFile(null);
      setMeta(EMPTY_META);
      document.getElementById('upload-file-input').value = '';
      onUploaded(data.document);
    } catch (err) {
      setError(err.message.includes('fetch') ? 'Cannot reach backend. Is it running on port 8000?' : err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSamples() {
    setSamplesLoading(true); setError(''); setSuccess('');
    try {
      const res  = await fetch(`${API}/api/samples`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to load samples.');
      setSuccess(`${data.documents.length} sample documents loaded.`);
      onSamplesLoaded(data.documents);
    } catch (err) {
      setError(err.message.includes('fetch') ? 'Cannot reach backend.' : err.message);
    } finally {
      setSamplesLoading(false);
    }
  }

  return (
    <div className="card upload-panel">
      <div className="section-title">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/>
          <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/>
        </svg>
        Upload Document
      </div>

      {error   && <div className="alert alert--error"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>{error}</div>}
      {success && <div className="alert alert--success"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>{success}</div>}

      <form onSubmit={handleUpload} noValidate>
        {/* Drop zone */}
        <div className="drop-zone" onClick={() => document.getElementById('upload-file-input').click()}>
          <input id="upload-file-input" type="file" accept=".pdf" onChange={handleFileChange} disabled={loading} />
          <div className="drop-zone-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/>
            </svg>
          </div>
          {file
            ? <p className="drop-zone-name">{file.name}</p>
            : <><p className="drop-zone-title">Click to choose a PDF</p><p className="drop-zone-sub">Supports PDF files only</p></>
          }
        </div>

        {/* Metadata fields */}
        <div className="meta-section">
          <p className="meta-heading">Document Metadata</p>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Title</label>
              <input className="form-input" placeholder="e.g. Medication Policy" value={meta.title}
                onChange={e => handleMeta('title', e.target.value)} disabled={loading} />
            </div>
            <div className="form-group">
              <label className="form-label">Version</label>
              <input className="form-input" placeholder="e.g. 2.0" value={meta.version}
                onChange={e => handleMeta('version', e.target.value)} disabled={loading} />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Publication Date</label>
              <input className="form-input" type="date" value={meta.publication_date}
                onChange={e => handleMeta('publication_date', e.target.value)} disabled={loading} />
            </div>
            <div className="form-group">
              <label className="form-label">Authority Tier</label>
              <select className="form-select" value={meta.authority_tier}
                onChange={e => handleMeta('authority_tier', parseInt(e.target.value))} disabled={loading}>
                {TIER_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Superseded By (filename, optional)</label>
            <input className="form-input" placeholder="e.g. policy_v2.pdf" value={meta.superseded_by}
              onChange={e => handleMeta('superseded_by', e.target.value)} disabled={loading} />
          </div>
        </div>

        <div className="upload-actions">
          <button type="submit" className="btn btn--primary btn--full" disabled={loading || !file}>
            {loading ? <><span className="spinner" /> Uploading…</> : <>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{width:16,height:16}}>
                <polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/>
                <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/>
              </svg>
              Upload Document
            </>}
          </button>
        </div>
      </form>

      {/* Divider */}
      <div className="upload-divider"><span>or</span></div>

      <button className="btn btn--secondary btn--full" onClick={handleSamples} disabled={samplesLoading}>
        {samplesLoading ? <><span className="spinner spinner--dark" /> Loading samples…</> : <>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{width:16,height:16}}>
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          Load Sample Documents (Demo)
        </>}
      </button>
      <p className="sample-hint">Loads 3 docs with intentional conflicts to demonstrate the pipeline.</p>
    </div>
  );
}

export default UploadPanel;
