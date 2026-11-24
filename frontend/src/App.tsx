import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  Invoice,
  InvoiceListResponse,
  InvoiceStats,
  PartnerColumn,
  PartnerMatrix,
  MonthlyPoint,
  ReportResponse,
  UploadResponse,
} from './types';
import UploadZone from './components/UploadZone';
import ProcessingProgress from './components/ProcessingProgress';
import PartnerSearch from './components/PartnerSearch';
import CashFlowChart from './components/CashFlowChart';
import PartnerTable from './components/PartnerTable';
import InvoiceList from './components/InvoiceList';
import {
  buildMonthlyFromInvoices,
  filterPartnerMatrix,
  invoicePartnerKey,
} from './lib/partnerFilter';

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
  const [allMonths, setAllMonths] = useState<MonthlyPoint[]>([]);
  const [allPartners, setAllPartners] = useState<PartnerMatrix>(emptyPartners);
  const [allReportInvoices, setAllReportInvoices] = useState<Invoice[]>([]);
  const [selectedPartner, setSelectedPartner] = useState<PartnerColumn | null>(null);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadLabel, setUploadLabel] = useState<string | null>(null);
  const [retryingId, setRetryingId] = useState<number | null>(null);
  /** Invoice ids for the current upload/retry progress (null = hide after idle/refresh) */
  const [progressIds, setProgressIds] = useState<number[] | null>(null);
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
      setAllMonths(reportData.months || []);
      setAllPartners(reportData.partners || emptyPartners);
      setAllReportInvoices(reportData.invoices || []);
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

  // Drop selection if partner disappeared after refresh
  useEffect(() => {
    if (!selectedPartner) return;
    const still = allPartners.partners.some((p) => p.key === selectedPartner.key);
    if (!still) setSelectedPartner(null);
  }, [allPartners, selectedPartner]);

  const filteredReportInvoices = useMemo(() => {
    if (!selectedPartner) return allReportInvoices;
    return allReportInvoices.filter(
      (inv) => invoicePartnerKey(inv) === selectedPartner.key,
    );
  }, [allReportInvoices, selectedPartner]);

  const months = useMemo(() => {
    if (!selectedPartner) return allMonths;
    return buildMonthlyFromInvoices(filteredReportInvoices);
  }, [selectedPartner, allMonths, filteredReportInvoices]);

  const partners = useMemo(() => {
    if (!selectedPartner) return allPartners;
    return filterPartnerMatrix(allPartners, selectedPartner.key);
  }, [selectedPartner, allPartners]);

  const progressStats = useMemo(() => {
    if (!progressIds || progressIds.length === 0) return null;
    const idSet = new Set(progressIds);
    const rows = invoices.filter((i) => idSet.has(i.id));
    // Until list refresh catches up, keep a placeholder total so the bar stays visible
    if (rows.length === 0) {
      return {
        total: progressIds.length,
        pending: progressIds.length,
        processing: 0,
        done: 0,
        error: 0,
        done_rules: 0,
        done_llm: 0,
        busy: progressIds.length,
        progress: 0,
      } satisfies InvoiceStats;
    }
    return statsFromInvoices(rows);
  }, [invoices, progressIds]);

  const batchBusy = progressStats != null && progressStats.busy > 0;
  const pipelineBusy = uploading || retryingId != null || batchBusy
    || (stats != null && stats.busy > 0);
  // progressIds stays until refresh or next upload/retry — block remains visible when batch finishes

  useEffect(() => {
    if (!pipelineBusy) {
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
  }, [pipelineBusy, refresh, refreshList]);

  const onUploadState = useCallback((active: boolean, label: string | null) => {
    setUploading(active);
    setUploadLabel(label);
  }, []);

  const onUploaded = useCallback(
    (data: UploadResponse) => {
      const acceptedIds: number[] = [];
      for (const r of data.results || []) {
        if (r.ok && !r.duplicate && r.invoice?.id != null) acceptedIds.push(r.invoice.id);
      }
      if (acceptedIds.length > 0) setProgressIds(acceptedIds);
      void refresh();
    },
    [refresh],
  );

  const onRetry = useCallback(
    async (id: number) => {
      setProgressIds([id]);
      setRetryingId(id);
      setListError(null);
      try {
        const res = await fetch(`/api/invoices/${id}/process`, { method: 'POST' });
        if (!res.ok) throw new Error(`Retry HTTP ${res.status}`);
        await refresh();
      } catch (e) {
        setListError(e instanceof Error ? e.message : String(e));
        await refreshList();
      } finally {
        setRetryingId(null);
      }
    },
    [refresh, refreshList],
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
          stats={progressStats}
          uploading={uploading}
          uploadLabel={uploadLabel}
          retrying={retryingId != null}
        />

        {listError && (
          <p className="mt-4 text-sm text-red-800">Adat hiba: {listError}</p>
        )}

        <PartnerSearch
          partners={allPartners.partners}
          selected={selectedPartner}
          onSelect={setSelectedPartner}
        />

        <CashFlowChart months={months} />
        <PartnerTable matrix={partners} />
        <InvoiceList
          invoices={invoices}
          reportInvoices={filteredReportInvoices}
          loading={loading}
          onRetry={(id) => void onRetry(id)}
          retryingId={retryingId}
        />
      </main>
    </div>
  );
}
