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

const METHOD_LABEL = {
  rules: 'szabályok',
  llm: 'LLM',
};

function formatMoney(amount, currency, fractionDigits) {
  if (amount == null) return '—';
  const n = Number(amount);
  const formatted = new Intl.NumberFormat('hu-HU', {
    minimumFractionDigits: fractionDigits ?? (n % 1 === 0 ? 0 : 2),
    maximumFractionDigits: fractionDigits ?? 2,
  }).format(n);
  return currency ? `${formatted} ${currency}` : formatted;
}

function methodBadge(inv) {
  if (inv.status !== 'done' && inv.status !== 'error') return null;
  const method = inv.extraction_method;
  if (!method) return null;
  return METHOD_LABEL[method] || method;
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
          {invoices.map((inv) => {
            const method = methodBadge(inv);
            return (
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
                    {method && (
                      <p className="mt-1 text-xs text-[var(--nw-ink)]/55">
                        Kinyerés:{' '}
                        <span className={method === 'LLM' ? 'text-[var(--nw-sky)]' : ''}>
                          {method === 'LLM'
                            ? 'LLM tartalék (szabályok nem voltak elegendőek)'
                            : 'szabályok alapján'}
                        </span>
                      </p>
                    )}
                    {inv.amount_huf != null && inv.currency && inv.currency !== 'HUF' && (
                      <p className="mt-1 text-xs text-[var(--nw-ink)]/50">
                        MNB {inv.mnb_rate}
                        {inv.mnb_rate_date ? ` (${inv.mnb_rate_date})` : ''}
                      </p>
                    )}
                    {inv.error_message && inv.status === 'error' && (
                      <p className="mt-1 text-sm text-red-800">{inv.error_message}</p>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-medium">
                      {formatMoney(inv.gross_amount, inv.currency)}
                    </p>
                    {inv.amount_huf != null && (
                      <p className="mt-0.5 text-sm text-[var(--nw-ink)]/80">
                        {formatMoney(inv.amount_huf, 'HUF', 0)}
                      </p>
                    )}
                    <p
                      className={[
                        'mt-1 text-sm',
                        inv.status === 'error' ? 'text-red-800' : 'text-[var(--nw-ink)]/70',
                      ].join(' ')}
                    >
                      {STATUS_LABEL[inv.status] || inv.status}
                      {method ? ` · ${method}` : ''}
                    </p>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
