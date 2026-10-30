import './ResultCard.css';

/* Status config: badge class, label, icon */
const STATUS_MAP = {
  verified:       { cls: 'green',  label: '✓ Verified',       desc: 'All sources are consistent.' },
  resolved:       { cls: 'blue',   label: '⊙ Resolved',        desc: 'Conflict resolved — trusted source identified.' },
  cannot_resolve: { cls: 'orange', label: '⚠ Cannot Resolve',  desc: 'Equally-authoritative sources conflict.' },
  no_evidence:    { cls: 'gray',   label: '— No Evidence',     desc: 'No relevant content found in documents.' },
};

function Icon({ name }) {
  if (name === 'quote') return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z"/>
      <path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z"/>
    </svg>
  );
  if (name === 'warn') return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
      <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>
  );
  if (name === 'shield') return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/>
    </svg>
  );
  if (name === 'cite') return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
    </svg>
  );
  if (name === 'clock') return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
    </svg>
  );
  return null;
}

function ResultCard({ result }) {
  const st = STATUS_MAP[result.status] || STATUS_MAP.no_evidence;
  const ts = new Date(result.timestamp).toLocaleString();

  return (
    <div className="result-card card">

      {/* ── Header: status + timestamp ── */}
      <div className="rc-header">
        <div className="rc-header-left">
          <span className={`badge badge--${st.cls} rc-status-badge`}>{st.label}</span>
          {result.ai_powered && (
            <span className="badge badge--purple">✨ Gemini AI</span>
          )}
          <span className="rc-status-desc">{st.desc}</span>
        </div>
        <span className="rc-timestamp"><Icon name="clock"/> {ts}</span>
      </div>

      {/* ── Question ── */}
      <div className="rc-question">
        <div className="rc-question-label">Question</div>
        <div className="rc-question-text">"{result.question}"</div>
      </div>

      {/* ── Synthesized Answer ── */}
      <div className="rc-section">
        <div className="rc-section-title"><Icon name="quote"/> Synthesized Answer</div>
        <div className="rc-answer">
          {result.citations && result.citations.length > 0 ? (
            result.citations.map((c, i) => {
              const label = (c.title || c.filename) + (c.version ? ` v${c.version}` : '');
              const isTrusted = c.filename === result.trusted_source;
              return (
                <div key={i} className={`rc-citation ${isTrusted ? 'rc-citation--trusted' : ''}`}>
                  <div className="rc-citation-header">
                    <Icon name="cite"/>
                    <span className="rc-citation-source">{label}</span>
                    {isTrusted && <span className="badge badge--green">Trusted Source</span>}
                    <span className="rc-score-pill">{c.score} kw match</span>
                  </div>
                  <blockquote className="rc-passage">"{c.passage}"</blockquote>
                </div>
              );
            })
          ) : (
            <p className="rc-no-content">No relevant content found in any document.</p>
          )}
        </div>
      </div>

      {/* ── Conflicts ── */}
      {result.contradictions && result.contradictions.length > 0 && (
        <div className="rc-section">
          <div className="rc-section-title rc-section-title--warn"><Icon name="warn"/>
            Conflicts Detected ({result.contradictions.length})
          </div>
          {result.contradictions.map((c, i) => (
            <div key={i} className="rc-conflict">
              <div className="rc-conflict-row">
                <div className="rc-conflict-side rc-conflict-side--a">
                  <span className="rc-conflict-doc">{c.doc_a.title || c.doc_a.filename}{c.doc_a.version ? ` v${c.doc_a.version}` : ''}</span>
                  <span className="rc-conflict-meta">Tier {c.doc_a.authority_tier} · {c.doc_a.publication_date}</span>
                  <blockquote className="rc-conflict-passage">"{c.doc_a.passage}"</blockquote>
                </div>
                <div className="rc-conflict-vs">VS</div>
                <div className="rc-conflict-side rc-conflict-side--b">
                  <span className="rc-conflict-doc">{c.doc_b.title || c.doc_b.filename}{c.doc_b.version ? ` v${c.doc_b.version}` : ''}</span>
                  <span className="rc-conflict-meta">Tier {c.doc_b.authority_tier} · {c.doc_b.publication_date}</span>
                  <blockquote className="rc-conflict-passage">"{c.doc_b.passage}"</blockquote>
                </div>
              </div>
              <div className="rc-conflict-sim">Similarity score: {(c.similarity * 100).toFixed(0)}%</div>
            </div>
          ))}
        </div>
      )}

      {/* ── Outdated documents ── */}
      {result.outdated && result.outdated.length > 0 && (
        <div className="rc-section">
          <div className="rc-section-title rc-section-title--warn"><Icon name="clock"/> Outdated Documents</div>
          {result.outdated.map((o, i) => (
            <div key={i} className="rc-outdated">
              <span className="badge badge--orange">Superseded</span>
              <span>"{o.title || o.filename}" is superseded by "{o.superseded_by}"</span>
            </div>
          ))}
        </div>
      )}

      {/* ── Cannot Resolve: all positions ── */}
      {result.status === 'cannot_resolve' && result.all_positions && result.all_positions.length > 0 && (
        <div className="rc-section">
          <div className="rc-section-title rc-section-title--warn"><Icon name="warn"/> All Conflicting Positions</div>
          {result.all_positions.map((p, i) => (
            <div key={i} className="rc-position">
              <span className="rc-position-source">{p.title || p.filename}{p.version ? ` v${p.version}` : ''}</span>
              <blockquote className="rc-position-passage">"{p.passage}"</blockquote>
            </div>
          ))}
        </div>
      )}

      {/* ── Resolution ── */}
      <div className={`rc-resolution rc-resolution--${st.cls}`}>
        <div className="rc-resolution-title"><Icon name="shield"/> Resolution</div>
        <p className="rc-resolution-reason">{result.resolution_reason}</p>
        {result.trusted_source && (
          <div className="rc-trusted-source">
            Trusted Source: <strong>{result.trusted_title || result.trusted_source}</strong>
          </div>
        )}
      </div>
    </div>
  );
}

export default ResultCard;
