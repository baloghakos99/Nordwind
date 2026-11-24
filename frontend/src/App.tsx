import { useCallback, useEffect, useState } from 'react';
import type { Invoice, InvoiceListResponse, PartnerMatrix, MonthlyPoint, ReportResponse } from './types';
import UploadZone from './components/UploadZone';
import CashFlowChart from './components/CashFlowChart';
import PartnerTable from './components/PartnerTable';
import InvoiceList from './components/InvoiceList';

const emptyPartners: PartnerMatrix = { partners: [], incoming: [], outgoing: [] };

export default function App() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [months, setMonths] = useState<MonthlyPoint[]>([]);
  const [partners, setPartners] = useState<PartnerMatrix>(emptyPartners);
  const [reportInvoices, setReportInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setListError(null);
    try {
      const [listRes, reportRes] = await Promise.all([
        fetch('/api/invoices'),
        fetch('/api/report'),
      ]);
      if (!listRes.ok) throw new Error(`HTTP ${listRes.status}`);
      if (!reportRes.ok) throw new Error(`Report HTTP ${reportRes.status}`);
      const listData = (await listRes.json()) as InvoiceListResponse;
      const reportData = (await reportRes.json()) as ReportResponse;
      setInvoices(listData.invoices || []);
      setMonths(reportData.months || []);
      setPartners(reportData.partners || emptyPartners);
      setReportInvoices(reportData.invoices || []);
    } catch (e) {
      setListError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

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
      <main className="mx-auto max-w-5xl">
        <p className="text-sm tracking-[0.2em] uppercase text-[var(--nw-sky)]">
          Nordwind Solutions Kft.
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight md:text-5xl">
          Számla cash-flow
        </h1>
        <p className="mt-4 max-w-xl text-lg leading-relaxed text-[var(--nw-ink)]/75">
          PDF számlák feltöltése, mezőkinyerés, MNB árfolyam — forintos kimutatás
          fizetési határidő és partner szerint.
        </p>

        <UploadZone
          onUploaded={() => {
            void refresh();
          }}
        />

        {listError && (
          <p className="mt-4 text-sm text-red-800">Adat hiba: {listError}</p>
        )}

        <CashFlowChart months={months} />
        <PartnerTable matrix={partners} />
        <InvoiceList
          invoices={invoices}
          reportInvoices={reportInvoices}
          loading={loading}
        />
      </main>
    </div>
  );
}
