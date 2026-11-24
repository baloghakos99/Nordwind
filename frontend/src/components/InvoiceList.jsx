const STATUS_LABEL = {
  pending: 'várakozik',
  processing: 'feldolgozás',
  done: 'kész',
  error: 'hiba',
};

const DIRECTION_LABEL = {
  incoming: 'bejövő',
  outgoing: 'kimenő',
};

function formatAmount(inv) {
  if (inv.gross_amount == null) return '—';
  const n = Number(inv.gross_amount);
  const formatted = new Intl.NumberFormat('hu-HU', {
    minimumFractionDigits: n % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(n);
  return `${formatted} ${inv.currency || ''}`.trim();
}

export default function InvoiceList({ invoices, loading }) {
  return (
    <section className="mt-12">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-sm font-medium uppercase tracking-wide text-[var(--nw-ink)]/60">
          Feltöltött számlák
        </h2>
        <span className="text-sm text-[var(--nw-ink)]/50">
          {loading ? 'betöltés…' : `${invoices.length} db`}
        </span>
      </div>

      {invoices.length === 0 && !loading && (
        <p className="mt-4 text-[var(--nw-ink)]/55">Még nincs feltöltött számla.</p>
      )}

      {invoices.length > 0 && (
        <ul className="mt-4 divide-y divide-[var(--nw-ink)]/10 border-t border-[var(--nw-ink)]/15">
          {invoices.map((inv) => (
            <li key={inv.id} className="py-4">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    {inv.invoice_number || inv.source_filename || `invoice #${inv.id}`}
                  </p>
                  <p className="mt-0.5 text-sm text-[var(--nw-ink)]/70">
                    {inv.partner_name || inv.issuer_name || '—'}
                    {inv.direction ? ` · ${DIRECTION_LABEL[inv.direction] || inv.direction}` : ''}
                  </p>
                  <p className="mt-1 font-mono text-xs text-[var(--nw-ink)]/45">
                    #{inv.id}
                    {inv.fulfillment_date ? ` · teljesítés ${inv.fulfillment_date}` : ''}
                    {inv.due_date ? ` · határidő ${inv.due_date}` : ''}
                  </p>
                  {inv.error_message && inv.status === 'error' && (
                    <p className="mt-1 text-sm text-red-800">{inv.error_message}</p>
                  )}
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-medium">{formatAmount(inv)}</p>
                  <p
                    className={[
                      'mt-1 text-sm',
                      inv.status === 'error' ? 'text-red-800' : 'text-[var(--nw-ink)]/70',
                    ].join(' ')}
                  >
                    {STATUS_LABEL[inv.status] || inv.status}
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
