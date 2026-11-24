import { useCallback, useEffect, useState } from 'react';
import InvoiceList from './components/InvoiceList.jsx';
import UploadZone from './components/UploadZone.jsx';

export default function App() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState(null);

  const refresh = useCallback(async () => {
    setListError(null);
    try {
      const res = await fetch('/api/invoices');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setInvoices(data.invoices || []);
    } catch (e) {
      setListError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Poll while any invoice is still pending/processing (extraction queue)
  useEffect(() => {
    const busy = invoices.some((i) => i.status === 'pending' || i.status === 'processing');
    if (!busy) return undefined;
    const t = setInterval(refresh, 1500);
    return () => clearInterval(t);
  }, [invoices, refresh]);

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
          Tölts fel PDF számlákat. A mezőket szabályalapú kinyerés tölti ki;
          a forintos kimutatás a következő fázisokban jön.
        </p>

        <UploadZone onUploaded={() => refresh()} />

        {listError && (
          <p className="mt-4 text-sm text-red-800">Lista hiba: {listError}</p>
        )}

        <InvoiceList invoices={invoices} loading={loading} />
      </main>
    </div>
  );
}
