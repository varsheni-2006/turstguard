import './Navbar.css';

function Navbar({ docCount }) {
  return (
    <nav className="navbar">
      <div className="container navbar-inner">
        <div className="navbar-brand">
          <div className="navbar-logo-box">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"
              strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              <polyline points="9 12 11 14 15 10"/>
            </svg>
          </div>
          <span className="navbar-name">Truth<span>Guard</span></span>
        </div>

        <div className="navbar-right">
          <span className="navbar-tag">Document Verification</span>
          <span className="navbar-status">
            <span className="navbar-status-dot" />
            {docCount} doc{docCount !== 1 ? 's' : ''} loaded
          </span>
        </div>
      </div>
    </nav>
  );
}

export default Navbar;
