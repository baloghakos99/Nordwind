import { useEffect, useState } from 'react';

export default function App() {
  const [health, setHealth] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch('/api/health')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(setHealth)
      .catch((e) => setError(e.message));
  }, []);

  return (
    <div className="min-h-screen px-6 py-16 md:px-12">
      <main className="mx-auto max-w-3xl">
        <p className="text-sm tracking-[0.2em] uppercase text-[var(--nw-sky)]">
          Nordwind Solutions Kft.
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight md:text-5xl">
          Számla cash-flow
        </h1>
        <p className="mt-4 max-w-xl text-lg leading-relaxed text-[var(--nw-ink)]/75">
          PDF számlák feltöltése, MNB árfolyamos forintos kimutatás. A váz
          (Phase 1) fut — feltöltés és feldolgozás a következő fázisokban jön.
        </p>

        <div className="mt-10 border-t border-[var(--nw-ink)]/15 pt-6">
          <p className="text-sm font-medium uppercase tracking-wide text-[var(--nw-ink)]/60">
            API állapot
          </p>
          {error && (
            <p className="mt-2 text-[var(--nw-ink)]">
              Nem elérhető: {error}
            </p>
          )}
          {health && (
            <p className="mt-2 font-mono text-sm">
              ok={String(health.ok)} · invoices={health.invoices}
            </p>
          )}
          {!health && !error && (
            <p className="mt-2 text-[var(--nw-ink)]/50">ellenőrzés…</p>
          )}
        </div>
      </main>
    </div>
  );
}
