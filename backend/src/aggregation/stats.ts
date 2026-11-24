import type { InvoiceRow } from '../types/invoice.js';

export interface InvoiceStats {
  total: number;
  pending: number;
  processing: number;
  done: number;
  error: number;
  done_rules: number;
  done_llm: number;
  /** pending + processing — pipeline still running */
  busy: number;
  /** finished share 0..1 (done + error) / total */
  progress: number;
}

export function buildInvoiceStats(rows: InvoiceRow[]): InvoiceStats {
  const stats: InvoiceStats = {
    total: rows.length,
    pending: 0,
    processing: 0,
    done: 0,
    error: 0,
    done_rules: 0,
    done_llm: 0,
    busy: 0,
    progress: 0,
  };

  for (const r of rows) {
    if (r.status === 'pending') stats.pending += 1;
    else if (r.status === 'processing') stats.processing += 1;
    else if (r.status === 'done') {
      stats.done += 1;
      if (r.extraction_method === 'rules') stats.done_rules += 1;
      else if (r.extraction_method === 'llm') stats.done_llm += 1;
    } else if (r.status === 'error') stats.error += 1;
  }

  stats.busy = stats.pending + stats.processing;
  const finished = stats.done + stats.error;
  stats.progress = stats.total === 0 ? 0 : finished / stats.total;
  return stats;
}
