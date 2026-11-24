import type { ExtractionMethod, Invoice, InvoiceDirection, InvoiceStatus } from '../types';

const STATUS_LABEL: Record<InvoiceStatus, string> = {
  pending: 'várakozik',
  processing: 'feldolgozás',
  done: 'kész',
  error: 'hiba',
};

const DIRECTION_LABEL: Record<InvoiceDirection, string> = {
  incoming: 'bejövő',
  outgoing: 'kimenő',
};

const METHOD_LABEL: Record<ExtractionMethod, string> = {
  rules: 'szabályok',
  llm: 'LLM',
};

function formatMoney(
  amount: number | null | undefined,
  currency?: string | null,
  fractionDigits?: number,
): string {
  if (amount == null) return '—';
  const n = Number(amount);
  const formatted = new Intl.NumberFormat('hu-HU', {
    minimumFractionDigits: fractionDigits ?? (n % 1 === 0 ? 0 : 2),
    maximumFractionDigits: fractionDigits ?? 2,
  }).format(n);
  return currency ? `${formatted} ${currency}` : formatted;
}

interface InvoiceListProps {
  /** All uploaded invoices (incl. pending/error) for status view */
  invoices: Invoice[];
  /** Report subset (done + HUF) — if provided, shown as detailed table */
  reportInvoices?: Invoice[];
  loading: boolean;
}

export default function InvoiceList({ invoices, reportInvoices, loading }: InvoiceListProps) {
  const detail = reportInvoices && reportInvoices.length > 0 ? reportInvoices : null;
  const pendingOrError = invoices.filter((i) => i.status !== 'done');

  return (
    <section className="mt-12">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-sm font-medium uppercase tracking-wide text-[var(--nw-ink)]/60">
          Számlalista
        </h2>
        <span className="text-sm text-[var(--nw-ink)]/50">
          {loading ? 'betöltés…' : `${invoices.length} feltöltött`}
        </span>
      </div>

      {detail ? (
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-[var(--nw-ink)]/20 text-left">
                <th className="py-2 pr-3 font-medium">Számla</th>
                <th className="px-2 py-2 font-medium">Partner</th>
                <th className="px-2 py-2 font-medium">Irány</th>
                <th className="px-2 py-2 font-medium">Teljesítés</th>
                <th className="px-2 py-2 font-medium">Határidő</th>
                <th className="px-2 py-2 font-medium text-right">Eredeti</th>
                <th className="px-2 py-2 font-medium text-right">MNB</th>
                <th className="px-2 py-2 font-medium text-right">HUF</th>
                <th className="pl-2 py-2 font-medium">Forrás</th>
              </tr>
            </thead>
            <tbody>
              {detail.map((inv) => (
                <tr key={inv.id} className="border-b border-[var(--nw-ink)]/10 align-top">
                  <td className="py-2 pr-3">
                    <div className="font-medium">{inv.invoice_number || `#${inv.id}`}</div>
                    <div className="font-mono text-xs text-[var(--nw-ink)]/45">
                      {inv.source_filename}
                    </div>
                  </td>
                  <td className="px-2 py-2 whitespace-nowrap">
                    <div>{inv.partner_name || '—'}</div>
                    <div className="font-mono text-xs text-[var(--nw-ink)]/45">
                      {inv.partner_tax_id || ''}
                    </div>
                  </td>
                  <td className="px-2 py-2 whitespace-nowrap">
                    {inv.direction ? DIRECTION_LABEL[inv.direction] : '—'}
                  </td>
                  <td className="px-2 py-2 font-mono text-xs whitespace-nowrap">
                    {inv.fulfillment_date || '—'}
                  </td>
                  <td className="px-2 py-2 font-mono text-xs whitespace-nowrap">
                    {inv.due_date || '—'}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums whitespace-nowrap">
                    {formatMoney(inv.gross_amount, inv.currency)}
                  </td>
                  <td className="px-2 py-2 text-right font-mono text-xs whitespace-nowrap">
                    {inv.currency === 'HUF'
                      ? '1'
                      : `${inv.mnb_rate ?? '—'} (${inv.mnb_rate_date || '—'})`}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums font-medium whitespace-nowrap">
                    {formatMoney(inv.amount_huf, 'HUF', 0)}
                  </td>
                  <td className="pl-2 py-2 text-xs text-[var(--nw-ink)]/60">
                    {inv.extraction_method
                      ? METHOD_LABEL[inv.extraction_method]
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        !loading && (
          <p className="mt-4 text-[var(--nw-ink)]/55">
            Még nincs sikeresen forintosított számla.
          </p>
        )
      )}

      {pendingOrError.length > 0 && (
        <div className="mt-8">
          <h3 className="text-xs font-medium uppercase tracking-wide text-[var(--nw-ink)]/50">
            Feldolgozás / hibák
          </h3>
          <ul className="mt-2 divide-y divide-[var(--nw-ink)]/10">
            {pendingOrError.map((inv) => (
              <li key={inv.id} className="flex justify-between gap-4 py-2 text-sm">
                <span className="truncate">
                  {inv.source_filename || `invoice #${inv.id}`}
                  {inv.error_message ? (
                    <span className="mt-0.5 block text-red-800">{inv.error_message}</span>
                  ) : null}
                </span>
                <span className={inv.status === 'error' ? 'text-red-800' : 'text-[var(--nw-ink)]/60'}>
                  {STATUS_LABEL[inv.status]}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
