import { useState } from 'react';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import VerifyForm from './components/VerifyForm';
import Results from './components/Results';
import Footer from './components/Footer';

/**
 * App – root component
 *
 * Holds the `submission` state that is shared between VerifyForm and Results.
 * When the user clicks "Verify Answer", VerifyForm calls onSubmit() which
 * stores the data here, and Results re-renders to show a "request received" notice.
 */
function App() {
  // null = nothing submitted yet
  // { documents: [...], question: string } = backend responded with upload results
  const [submission, setSubmission] = useState(null);


  function handleSubmit(data) {
    setSubmission(data);
    // Scroll to results so the user can see the update
    document.getElementById('results-anchor')?.scrollIntoView({ behavior: 'smooth' });
  }

  return (
    <>
      {/* ── Top navigation bar ── */}
      <Navbar />

      {/* ── Hero: headline + description + pills ── */}
      <Hero />

      {/* ── Main form: upload + question + button ── */}
      <main>
        <VerifyForm onSubmit={handleSubmit} />

        {/* Invisible anchor so we can scroll to results */}
        <div id="results-anchor" />

        {/* ── Results placeholder ── */}
        <Results submission={submission} />
      </main>

      {/* ── Footer ── */}
      <Footer />
    </>
  );
}

export default App;
