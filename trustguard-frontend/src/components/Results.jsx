import './Results.css';

/**
 * Results component
 *
 * Props:
 *   submission – null  →  empty state
 *              – { documents, question, answers, has_conflict, conflict_reason }
 *
 * `answers` is an array of:
 *   { filename, passage, score, found }
 */
function Results({ submission }) {
  return (
    <section className="results-section" aria-label="Verification results">
      <div className="container">

        {/* Heading */}
        <div className="results-heading">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="20" x2="18" y2="10" />
            <line x1="12" y1="20" x2="12" y2="4" />
            <line x1="6" y1="20" x2="6" y2="14" />
          </svg>
          Verification Results
        </div>

        {/* ── Empty state ── */}
        {!submission && (
          <div className="results-empty" aria-live="polite">
            <div className="results-empty-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
                <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
              </svg>
            </div>
            <h3>No results yet</h3>
            <p>
              Upload your PDF documents, type your question, and click
              <strong> Verify Answer</strong> to see the analysis here.
            </p>
          </div>
        )}

        {/* ── Results ── */}
        {submission && (
          <div aria-live="polite">

            {/* Question banner */}
            <div className="results-question-chip">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              <span>
                <strong>Question:</strong>&nbsp;{submission.question}
              </span>
            </div>

            {/* ── Conflict warning ── */}
            {submission.has_conflict && (
              <div className="conflict-banner" role="alert">
                <div className="conflict-banner-icon" aria-hidden="true">
                  {/* Warning triangle */}
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                    <line x1="12" y1="9" x2="12" y2="13" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                </div>
                <div>
                  <strong>⚠ Conflict Detected</strong>
                  <p>{submission.conflict_reason}</p>
                </div>
              </div>
            )}

            {/* ── No conflict — all consistent ── */}
            {!submission.has_conflict &&
              submission.answers &&
              submission.answers.some(a => a.found) && (
              <div className="consistent-banner">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  <polyline points="9 12 11 14 15 10" />
                </svg>
                <span>Documents appear <strong>consistent</strong> on this topic.</span>
              </div>
            )}

            {/* ── Per-document answer cards ── */}
            <div className="answers-grid">
              {submission.answers && submission.answers.map((ans) => (
                <div
                  key={ans.filename}
                  className={`answer-card ${ans.found ? 'answer-card--found' : 'answer-card--missing'}`}
                >
                  {/* Card header */}
                  <div className="answer-card-header">
                    <div className={`answer-status-dot ${ans.found ? '' : 'answer-status-dot--missing'}`}
                      aria-hidden="true" />
                    <span className="answer-filename">{ans.filename}</span>
                    {ans.found && (
                      <span className="answer-score-badge">
                        {ans.score} keyword{ans.score !== 1 ? 's' : ''} matched
                      </span>
                    )}
                  </div>

                  {/* Passage text */}
                  <blockquote className={`answer-passage ${ans.found ? '' : 'answer-passage--missing'}`}>
                    {ans.passage}
                  </blockquote>
                </div>
              ))}
            </div>

            {/* ── Upload summary footer ── */}
            <div className="results-summary">
              <span>
                {submission.documents.filter(d => d.status === 'ok').length} of{' '}
                {submission.documents.length} document
                {submission.documents.length !== 1 ? 's' : ''} processed
              </span>
              <span className="results-summary-note">
                {submission.answers && submission.answers.filter(a => a.found).length} document
                {submission.answers && submission.answers.filter(a => a.found).length !== 1 ? 's' : ''} had relevant content
              </span>
            </div>

          </div>
        )}

      </div>
    </section>
  );
}

export default Results;
