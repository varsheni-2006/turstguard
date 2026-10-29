import './Hero.css';

/**
 * Hero section
 * Displays the main headline, a short description, and three feature pills.
 */
function Hero() {
  return (
    <section className="hero" aria-labelledby="hero-heading">
      <div className="container">

        {/* Big icon at top */}
        <div className="hero-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            <polyline points="9 12 11 14 15 10" />
          </svg>
        </div>

        {/* Main heading */}
        <h1 id="hero-heading">Answers You Can Trust.</h1>

        {/* Short description */}
        <p>
          Upload your PDF documents, ask any question, and TruthGuard will
          detect conflicting information across your files to surface the most
          reliable answer — powered by AI document analysis.
        </p>

        {/* Feature pills */}
        <div className="hero-pills" role="list">
          <span className="hero-pill" role="listitem">
            {/* Document icon */}
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
            PDF Upload
          </span>

          <span className="hero-pill" role="listitem">
            {/* Conflict icon */}
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            Conflict Detection
          </span>

          <span className="hero-pill" role="listitem">
            {/* Check icon */}
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            Trust Scoring
          </span>
        </div>

      </div>
    </section>
  );
}

export default Hero;
