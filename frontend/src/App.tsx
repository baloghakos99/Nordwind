import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  Invoice,
  InvoiceListResponse,
  InvoiceStats,
  PartnerMatrix,
  MonthlyPoint,
  ReportResponse,
  UploadResponse,
} from './types';
import UploadZone from './components/UploadZone';
import ProcessingProgress from './components/ProcessingProgress';
import CashFlowChart from './components/CashFlowChart';
import PartnerTable from './components/PartnerTable';
import InvoiceList from './components/InvoiceList';

const emptyPartners: PartnerMatrix = { partners: [], incoming: [], outgoing: [] };

const POLL_BUSY_MS = 800;

function statsFromInvoices(rows: Invoice[]): InvoiceStats {
  const pending = rows.filter((i) => i.status === 'pending').length;
  const processing = rows.filter((i) => i.status === 'processing').length;
  const done = rows.filter((i) => i.status === 'done').length;
  const error = rows.filter((i) => i.status === 'error').length;
  const done_rules = rows.filter((i) => i.status === 'done' && i.extraction_method === 'rules').length;
  const done_llm = rows.filter((i) => i.status === 'done' && i.extraction_method === 'llm').length;
  const total = rows.length;
  const busy = pending + processing;
  return {
    total,
    pending,
    processing,
    done,
    error,
    done_rules,
    done_llm,
    busy,
    progress: total === 0 ? 0 : (done + error) / total,
  };
}

export default function App() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [stats, setStats] = useState<InvoiceStats | null>(null);
  const [months, setMonths] = useState<MonthlyPoint[]>([]);
  const [partners, setPartners] = useState<PartnerMatrix>(emptyPartners);
  const [reportInvoices, setReportInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadLabel, setUploadLabel] = useState<string | null>(null);
  const wasBusyRef = useRef(false);

  const applyList = useCallback((listData: InvoiceListResponse) => {
    const rows = listData.invoices || [];
    setInvoices(rows);
    setStats(listData.stats ?? statsFromInvoices(rows));
  }, []);

  const refreshList = useCallback(async () => {
    setListError(null);
    try {
      const listRes = await fetch('/api/invoices');
      if (!listRes.ok) throw new Error(`HTTP ${listRes.status}`);
      applyList((await listRes.json()) as InvoiceListResponse);
    } catch (e) {
      setListError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [applyList]);

  const refreshReport = useCallback(async () => {
    try {
      const reportRes = await fetch('/api/report');
      if (!reportRes.ok) throw new Error(`Report HTTP ${reportRes.status}`);
      const reportData = (await reportRes.json()) as ReportResponse;
      setMonths(reportData.months || []);
      setPartners(reportData.partners || emptyPartners);
      setReportInvoices(reportData.invoices || []);
    } catch (e) {
      setListError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  const refresh = useCallback(async () => {
    await Promise.all([refreshList(), refreshReport()]);
  }, [refreshList, refreshReport]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const busy = uploading || (stats != null && stats.busy > 0);

  // While pipeline busy: poll list often; when it settles, refresh report once
  useEffect(() => {
    if (!busy) {
      if (wasBusyRef.current) {
        wasBusyRef.current = false;
        void refresh();
      }
      return undefined;
    }
    wasBusyRef.current = true;
    const t = setInterval(() => {
      void refreshList();
    }, POLL_BUSY_MS);
    return () => clearInterval(t);
  }, [busy, refresh, refreshList]);

  const onUploadState = useCallback((active: boolean, label: string | null) => {
    setUploading(active);
    setUploadLabel(label);
  }, []);

  const onUploaded = useCallback(
    (_data: UploadResponse) => {
      void refresh();
    },
    [refresh],
  );

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

        <UploadZone onUploaded={onUploaded} onUploadState={onUploadState} />

        <ProcessingProgress
          stats={stats}
          uploading={uploading}
          uploadLabel={uploadLabel}
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
