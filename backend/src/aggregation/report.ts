import type { InvoiceDirection } from '../types/domain.js';
import type { InvoiceRow } from '../types/invoice.js';

export interface MonthlyPoint {
  month: string; // YYYY-MM
  incoming: number;
  outgoing: number;
}

export interface PartnerColumn {
  key: string;
  label: string;
  tax_id: string | null;
}

export interface PartnerMatrix {
  partners: PartnerColumn[];
  incoming: number[];
  outgoing: number[];
}

export interface ReportPayload {
  months: MonthlyPoint[];
  partners: PartnerMatrix;
  invoices: InvoiceRow[];
}

/** Done invoices with HUF amount — input to aggregation. */
export function reportableInvoices(rows: InvoiceRow[]): InvoiceRow[] {
  return rows.filter(
    (r) => r.status === 'done' && r.amount_huf != null && Number.isFinite(r.amount_huf),
  );
}

function monthKey(isoDate: string): string | null {
  const m = isoDate.match(/^(\d{4}-\d{2})/);
  return m ? m[1] : null;
}

function addMonth(ym: string, delta: number): string {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function compareYm(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Monthly cash-flow by due date. Continuous month range; empty months = 0.
 */
export function buildMonthlySeries(invoices: InvoiceRow[]): MonthlyPoint[] {
  const rows = reportableInvoices(invoices).filter((r) => r.due_date);
  if (rows.length === 0) return [];

  const months = rows
    .map((r) => monthKey(r.due_date as string))
    .filter((m): m is string => Boolean(m));
  months.sort(compareYm);
  const start = months[0];
  const end = months[months.length - 1];

  const map = new Map<string, { incoming: number; outgoing: number }>();
  for (let cur = start; compareYm(cur, end) <= 0; cur = addMonth(cur, 1)) {
    map.set(cur, { incoming: 0, outgoing: 0 });
  }

  for (const inv of rows) {
    const key = monthKey(inv.due_date as string);
    if (!key || !map.has(key)) continue;
    const bucket = map.get(key)!;
    const amt = Number(inv.amount_huf) || 0;
    if (inv.direction === 'incoming') bucket.incoming += amt;
    else if (inv.direction === 'outgoing') bucket.outgoing += amt;
  }

  return [...map.entries()].map(([month, v]) => ({
    month,
    incoming: v.incoming,
    outgoing: v.outgoing,
  }));
}

export function partnerKey(inv: InvoiceRow): string {
  const tax = (inv.partner_tax_id || '').trim();
  if (tax) return `tax:${tax.toUpperCase().replace(/\s/g, '')}`;
  const name = (inv.partner_name || '').trim();
  if (name) return `name:${name.toLowerCase()}`;
  return `id:${inv.id}`;
}

/**
 * Partner matrix: columns = partners (by tax id), rows = total incoming / outgoing HUF.
 */
export function buildPartnerMatrix(invoices: InvoiceRow[]): PartnerMatrix {
  const rows = reportableInvoices(invoices);
  type Agg = {
    label: string;
    tax_id: string | null;
    incoming: number;
    outgoing: number;
  };
  const byKey = new Map<string, Agg>();

  for (const inv of rows) {
    if (!inv.direction) continue;
    const key = partnerKey(inv);
    let agg = byKey.get(key);
    const displayName = (inv.partner_name || inv.partner_tax_id || `Partner #${inv.id}`).toLocaleUpperCase('hu-HU');
    if (!agg) {
      agg = {
        label: displayName,
        tax_id: inv.partner_tax_id,
        incoming: 0,
        outgoing: 0,
      };
      byKey.set(key, agg);
    } else if (inv.partner_name && agg.label.length < displayName.length) {
      agg.label = displayName;
    }
    const amt = Number(inv.amount_huf) || 0;
    if (inv.direction === 'incoming') agg.incoming += amt;
    if (inv.direction === 'outgoing') agg.outgoing += amt;
  }

  const partners = [...byKey.entries()]
    .sort((a, b) => a[1].label.localeCompare(b[1].label, 'hu'))
    .map(([key, v]) => ({
      key,
      label: v.label.toLocaleUpperCase('hu-HU'),
      tax_id: v.tax_id,
    }));

  return {
    partners,
    incoming: partners.map((p) => byKey.get(p.key)!.incoming),
    outgoing: partners.map((p) => byKey.get(p.key)!.outgoing),
  };
}

export function buildReport(invoices: InvoiceRow[]): ReportPayload {
  const done = reportableInvoices(invoices);
  return {
    months: buildMonthlySeries(invoices),
    partners: buildPartnerMatrix(invoices),
    invoices: [...done].sort((a, b) => {
      const da = a.due_date || '';
      const db_ = b.due_date || '';
      if (da !== db_) return da < db_ ? -1 : 1;
      return a.id - b.id;
    }),
  };
}

export type { InvoiceDirection };
