import { useState } from 'react';
import './VerifyForm.css';

/**
 * VerifyForm component
 *
 * Sends the selected PDF files to the FastAPI backend at POST /upload.
 * Shows a loading spinner while the upload is in progress.
 * Passes the backend response up to App via onSubmit().
 */
function VerifyForm({ onSubmit }) {
  // List of File objects selected by the user
  const [files, setFiles] = useState([]);

  // The question the user typed
  const [question, setQuestion] = useState('');

  // true while we are waiting for the backend to respond
  const [loading, setLoading] = useState(false);

  // Error message to show if the whole request fails (network error etc.)
  const [globalError, setGlobalError] = useState('');

  // Called when the user picks files
  function handleFileChange(event) {
    setFiles(Array.from(event.target.files));
    setGlobalError(''); // clear any previous error
  }

  // Two-step label shown during loading
  const [loadingStep, setLoadingStep] = useState('');

  // Called when the form is submitted
  async function handleSubmit(event) {
    event.preventDefault();

    if (files.length === 0) {
      setGlobalError('Please select at least one PDF file before verifying.');
      return;
    }
    if (!question.trim()) {
      setGlobalError('Please type a question before verifying.');
      return;
    }

    setLoading(true);
    setGlobalError('');

    try {
      // ── Step 1: Upload PDFs ───────────────────────────────────────────────
      setLoadingStep('Uploading & extracting text…');
      const formData = new FormData();
      for (const file of files) {
        formData.append('files', file);
      }

      const uploadRes = await fetch('http://localhost:8000/upload', {
        method: 'POST',
        body: formData,
      });

      if (!uploadRes.ok) {
        const err = await uploadRes.json().catch(() => ({}));
        throw new Error(err.detail || `Upload failed: ${uploadRes.status}`);
      }

      const uploadData = await uploadRes.json();  // { documents: [...] }

      // ── Step 2: Ask the question ──────────────────────────────────────────
      setLoadingStep('Searching documents for your answer…');
      const askRes = await fetch('http://localhost:8000/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: question.trim() }),
      });

      if (!askRes.ok) {
        const err = await askRes.json().catch(() => ({}));
        throw new Error(err.detail || `Search failed: ${askRes.status}`);
      }

      const askData = await askRes.json();
      // { question, answers: [...], has_conflict, conflict_reason }

      // Pass both results up to App
      if (onSubmit) {
        onSubmit({
          documents: uploadData.documents,
          question: askData.question,
          answers: askData.answers,
          has_conflict: askData.has_conflict,
          conflict_reason: askData.conflict_reason,
        });
      }

      document.getElementById('results-anchor')?.scrollIntoView({ behavior: 'smooth' });

    } catch (err) {
      setGlobalError(
        err.message.includes('Failed to fetch')
          ? 'Cannot reach the backend. Make sure the FastAPI server is running on port 8000.'
          : err.message
      );
    } finally {
      setLoading(false);
      setLoadingStep('');
    }
  }

  return (
    <section className="verify-section" aria-label="Document verification form">
      <div className="container">
        <form onSubmit={handleSubmit} noValidate>

          {/* ── Card 1: Upload PDFs ── */}
          <div className="card">
            <div className="card-label">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="16 16 12 12 8 16" />
                <line x1="12" y1="12" x2="12" y2="21" />
                <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" />
              </svg>
              Upload Documents
            </div>

            {/* Clickable drop zone */}
            <div className="upload-area" role="button" tabIndex={0}
              aria-label="Click to upload PDF documents">
              <input
                id="pdf-upload"
                type="file"
                accept=".pdf"
                multiple
                onChange={handleFileChange}
                aria-label="Select PDF files"
                disabled={loading}
              />

              <div className="upload-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="12" y1="18" x2="12" y2="12" />
                  <line x1="9" y1="15" x2="15" y2="15" />
                </svg>
              </div>

              <p className="upload-title">Click to upload PDFs</p>
              <p className="upload-subtitle">
                Supports PDF files · You can select multiple files
              </p>
            </div>

            {/* Selected file chips */}
            {files.length > 0 && (
              <ul className="file-list" aria-label="Selected files">
                {files.map((file) => (
                  <li key={file.name} className="file-chip">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                    </svg>
                    {file.name}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* ── Card 2: Ask a Question ── */}
          <div className="card">
            <div className="card-label">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              Your Question
            </div>

            <textarea
              id="question-input"
              className="question-textarea"
              placeholder="e.g. What is the patient's prescribed dosage according to these documents?"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              aria-label="Type your question here"
              rows={4}
              disabled={loading}
            />
          </div>

          {/* ── Global error message ── */}
          {globalError && (
            <div className="form-error" role="alert" aria-live="assertive">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              {globalError}
            </div>
          )}

          {/* ── Verify Button ── */}
          <button
            id="verify-btn"
            type="submit"
            className={`verify-btn${loading ? ' verify-btn--loading' : ''}`}
            aria-label="Verify answer across uploaded documents"
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="spinner" aria-hidden="true" />
                {loadingStep || 'Processing…'}
              </>
            ) : (
              <>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                Verify Answer
              </>
            )}
          </button>

        </form>
      </div>
    </section>
  );
}

export default VerifyForm;
