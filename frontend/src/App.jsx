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
          Tölts fel PDF számlákat. A fájlok megmaradnak, a kimutatás a
          feldolgozás után készül el.
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
