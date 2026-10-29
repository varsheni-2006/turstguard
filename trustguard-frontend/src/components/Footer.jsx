import './Footer.css';

/**
 * Footer component
 * Simple dark footer with brand name, copyright, and tagline.
 */
function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="footer" role="contentinfo">
      <div className="container footer-inner">

        {/* Brand */}
        <div className="footer-brand">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
            aria-hidden="true">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            <polyline points="9 12 11 14 15 10" />
          </svg>
          TruthGuard
        </div>

        {/* Copyright */}
        <span className="footer-copy">
          © {year} TrustNexus. All rights reserved.
        </span>

        {/* Tagline */}
        <span className="footer-tagline">Answers You Can Trust.</span>

      </div>
    </footer>
  );
}

export default Footer;
