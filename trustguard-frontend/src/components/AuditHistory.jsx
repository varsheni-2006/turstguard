import { useState } from 'react';
import './AuditHistory.css';

const STATUS_BADGE = {
  verified:       { cls: 'green',  label: '✓ Verified' },
  resolved:       { cls: 'blue',   label: '⊙ Resolved' },
  cannot_resolve: { cls: 'orange', label: '⚠ Cannot Resolve' },
  no_evidence:    { cls: 'gray',   label: '— No Evidence' },
};

function AuditHistory({ history }) {
  const [open, setOpen] = useState(true);

  return (
    <div className="audit-panel card">
      <button className="audit-toggle" onClick={() => setOpen(o => !o)}>
        <span className="section-title" style={{ margin: 0 }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/>
            <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>
          </svg>
          Audit History
          <span className="audit-count">{history.length}</span>
        </span>
        <svg className={`audit-chevron ${open ? 'open' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>

      {open && (
        <div className="audit-body">
          {history.length === 0 ? (
            <div className="audit-empty">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/>
                <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>
              </svg>
              <p>No queries yet. Ask a question to see the audit log.</p>
            </div>
          ) : (
            <div className="audit-table-wrap">
              <table className="audit-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Timestamp</th>
                    <th>Question</th>
                    <th>Status</th>
                    <th>Conflicts</th>
                    <th>Trusted Source</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((row, i) => {
                    const sb = STATUS_BADGE[row.status] || STATUS_BADGE.no_evidence;
                    return (
                      <tr key={row.id} className="audit-row">
                        <td className="audit-num">{history.length - i}</td>
                        <td className="audit-time">{new Date(row.timestamp).toLocaleString()}</td>
                        <td className="audit-q">
                          <span className="audit-q-text">{row.question}</span>
                          <span className="audit-preview">{row.answer_preview}</span>
                        </td>
                        <td><span className={`badge badge--${sb.cls}`}>{sb.label}</span></td>
                        <td className="audit-conflicts">
                          {row.conflicts_detected > 0
                            ? <span className="badge badge--orange">{row.conflicts_detected} found</span>
                            : <span className="audit-none">—</span>}
                        </td>
                        <td className="audit-source">
                          {row.trusted_title || row.trusted_source || <span className="audit-none">—</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default AuditHistory;
