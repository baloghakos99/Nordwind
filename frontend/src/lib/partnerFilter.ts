import type { Invoice, MonthlyPoint, PartnerColumn, PartnerMatrix } from '../types';

export function invoicePartnerKey(inv: Pick<Invoice, 'id' | 'partner_name' | 'partner_tax_id'>): string {
  const tax = (inv.partner_tax_id || '').trim();
  if (tax) return `tax:${tax.toUpperCase().replace(/\s/g, '')}`;
  const name = (inv.partner_name || '').trim();
  if (name) return `name:${name.toLowerCase()}`;
  return `id:${inv.id}`;
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

/** Monthly series from filtered report invoices (due date). */
export function buildMonthlyFromInvoices(invoices: Invoice[]): MonthlyPoint[] {
  const rows = invoices.filter((r) => r.due_date && r.amount_huf != null);
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

export function filterPartnerMatrix(
  matrix: PartnerMatrix,
  partnerKey: string,
): PartnerMatrix {
  const idx = matrix.partners.findIndex((p) => p.key === partnerKey);
  if (idx < 0) return { partners: [], incoming: [], outgoing: [] };
  return {
    partners: [matrix.partners[idx]],
    incoming: [matrix.incoming[idx]],
    outgoing: [matrix.outgoing[idx]],
  };
}

export function matchPartners(
  partners: PartnerColumn[],
  query: string,
): PartnerColumn[] {
  const q = query.trim().toLocaleLowerCase('hu-HU');
  if (!q) return partners.slice(0, 12);
  return partners
    .filter((p) => {
      const label = p.label.toLocaleLowerCase('hu-HU');
      const tax = (p.tax_id || '').toLocaleLowerCase('hu-HU');
      return label.includes(q) || tax.includes(q);
    })
    .slice(0, 12);
}
