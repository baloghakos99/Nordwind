import { useCallback, useEffect, useState } from 'react';
import type { Invoice, InvoiceListResponse } from './types';
import UploadZone from './components/UploadZone';
import InvoiceList from './components/InvoiceList';

export default function App() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setListError(null);
    try {
      const res = await fetch('/api/invoices');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as InvoiceListResponse;
      setInvoices(data.invoices || []);
    } catch (e) {
      setListError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Poll while any invoice is still pending/processing (extraction queue)
  useEffect(() => {
    const busy = invoices.some((i) => i.status === 'pending' || i.status === 'processing');
    if (!busy) return undefined;
    const t = setInterval(() => {
      void refresh();
    }, 1500);
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

        <UploadZone onUploaded={() => {
          void refresh();
        }}
        />

        {listError && (
          <p className="mt-4 text-sm text-red-800">Lista hiba: {listError}</p>
        )}

        <InvoiceList invoices={invoices} loading={loading} />
      </main>
    </div>
  );
}
