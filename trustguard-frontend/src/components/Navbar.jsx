import './Navbar.css';

/**
 * Navbar component
 * Shows the TruthGuard logo and a small badge at the top of every page.
 */
function Navbar() {
  return (
    <nav className="navbar" role="banner">
      <div className="container navbar-inner">

        {/* Logo */}
        <div className="navbar-logo">
          {/* Shield icon – drawn with inline SVG, no library needed */}
          <div className="navbar-logo-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"
              strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <polyline points="9 12 11 14 15 10" />
            </svg>
          </div>

          <span className="navbar-logo-text">
            Truth<span>Guard</span>
          </span>
        </div>

        {/* Small badge */}
        <span className="navbar-badge">Document Verification</span>

      </div>
    </nav>
  );
}

export default Navbar;
