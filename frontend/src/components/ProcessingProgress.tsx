import type { InvoiceStats } from '../types';

interface ProcessingProgressProps {
  stats: InvoiceStats | null;
  uploading?: boolean;
  uploadLabel?: string | null;
  /** True while a single-invoice retry is in flight */
  retrying?: boolean;
}

export default function ProcessingProgress({
  stats,
  uploading = false,
  uploadLabel = null,
  retrying = false,
}: ProcessingProgressProps) {
  const queueBusy = stats != null && stats.busy > 0;
  // Show for current batch (incl. after done/error), upload, or retry; hide after page refresh (no stats)
  if (!uploading && !retrying && !stats) return null;

  const pct = stats ? Math.round(stats.progress * 100) : 0;
  const busy = uploading || retrying || queueBusy;

  return (
    <section className="mt-8" aria-live="polite">
      <h2 className="text-sm font-medium uppercase tracking-wide text-[var(--nw-ink)]/60">
        Feldolgozás állapota
      </h2>

      {uploading && (
        <p className="mt-2 text-sm text-[var(--nw-sky)]">
          {uploadLabel || 'Feltöltés folyamatban…'}
        </p>
      )}

      {stats && stats.total > 0 && (
        <>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-sm bg-[var(--nw-ink)]/10">
            <div
              className={[
                'h-full transition-[width] duration-500 ease-out',
                busy ? 'bg-[var(--nw-sky)]' : 'bg-[var(--nw-ink)]/70',
              ].join(' ')}
              style={{ width: `${pct}%` }}
            />
          </div>

          <p className="mt-2 text-sm text-[var(--nw-ink)]/80">
            <span className="font-medium tabular-nums">
              {stats.done + stats.error}/{stats.total}
            </span>
            {' lezárva'}
            {busy ? ' — folyamatban…' : ' — kész'}
            {' · '}
            {pct}%
          </p>

          <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-[var(--nw-ink)]/65">
            <li>várakozik: <span className="tabular-nums text-[var(--nw-ink)]">{stats.pending}</span></li>
            <li>feldolgozás: <span className="tabular-nums text-[var(--nw-ink)]">{stats.processing}</span></li>
            <li>kész: <span className="tabular-nums text-[var(--nw-ink)]">{stats.done}</span></li>
            <li>hiba: <span className="tabular-nums text-[var(--nw-ink)]">{stats.error}</span></li>
          </ul>

          {(stats.done_rules > 0 || stats.done_llm > 0) && (
            <p className="mt-1 text-xs text-[var(--nw-ink)]/50">
              Kinyerés — szabályok: {stats.done_rules} · LLM: {stats.done_llm}
            </p>
          )}
        </>
      )}
    </section>
  );
}
