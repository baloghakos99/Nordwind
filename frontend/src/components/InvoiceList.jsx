const STATUS_LABEL = {
  pending: 'várakozik',
  processing: 'feldolgozás',
  done: 'kész',
  error: 'hiba',
};

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
            <li key={inv.id} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="truncate font-medium">{inv.source_filename || `invoice #${inv.id}`}</p>
                <p className="mt-0.5 font-mono text-xs text-[var(--nw-ink)]/45">
                  #{inv.id}
                  {inv.file_hash ? ` · ${inv.file_hash.slice(0, 10)}…` : ''}
                </p>
                {inv.error_message && (
                  <p className="mt-1 text-sm text-red-800">{inv.error_message}</p>
                )}
              </div>
              <span
                className={[
                  'shrink-0 text-sm',
                  inv.status === 'error' ? 'text-red-800' : 'text-[var(--nw-ink)]/70',
                ].join(' ')}
              >
                {STATUS_LABEL[inv.status] || inv.status}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
