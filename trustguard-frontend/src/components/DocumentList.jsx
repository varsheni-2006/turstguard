import './DocumentList.css';

const TIER_LABEL = { 1:'T1', 2:'T2', 3:'T3', 4:'T4', 5:'T5' };
const TIER_COLOR = { 1:'blue', 2:'blue', 3:'gray', 4:'gray', 5:'gray' };

function DocumentList({ documents, onDelete }) {
  if (documents.length === 0) {
    return (
      <div className="card doc-list-empty">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
        </svg>
        <p>No documents loaded yet.</p>
        <span>Upload a PDF or load sample documents.</span>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="section-title">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
        </svg>
        Loaded Documents
        <span className="doc-count-badge">{documents.length}</span>
      </div>

      <ul className="doc-list">
        {documents.map(doc => (
          <li key={doc.id} className={`doc-item ${doc.superseded_by ? 'doc-item--outdated' : ''}`}>
            <div className="doc-item-left">
              <div className="doc-item-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                </svg>
              </div>
              <div className="doc-item-info">
                <span className="doc-item-name">{doc.title || doc.filename}</span>
                <div className="doc-item-meta">
                  {doc.version && <span className="doc-meta-tag">v{doc.version}</span>}
                  {doc.publication_date && <span className="doc-meta-tag">{doc.publication_date}</span>}
                  {doc.authority_tier && (
                    <span className={`badge badge--${TIER_COLOR[doc.authority_tier] || 'gray'}`}>
                      {TIER_LABEL[doc.authority_tier] || `T${doc.authority_tier}`}
                    </span>
                  )}
                  {doc.superseded_by && (
                    <span className="badge badge--orange">Superseded</span>
                  )}
                  <span className="doc-chars">{doc.char_count?.toLocaleString()} chars</span>
                </div>
              </div>
            </div>
            <button className="btn btn--danger btn--sm" onClick={() => onDelete(doc.id)} title="Delete document">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{width:14,height:14}}>
                <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
              </svg>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default DocumentList;
