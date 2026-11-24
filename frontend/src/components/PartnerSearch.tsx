import { useEffect, useId, useRef, useState } from 'react';
import type { PartnerColumn } from '../types';
import { matchPartners } from '../lib/partnerFilter';

interface PartnerSearchProps {
  partners: PartnerColumn[];
  selected: PartnerColumn | null;
  onSelect: (partner: PartnerColumn | null) => void;
}

export default function PartnerSearch({
  partners,
  selected,
  onSelect,
}: PartnerSearchProps) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (selected) setQuery(selected.label);
  }, [selected]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const suggestions = matchPartners(partners, query);
  const showList = open && !selected && suggestions.length > 0;

  return (
    <div ref={rootRef} className="relative mt-12 max-w-xl">
      <label
        htmlFor={listId}
        className="text-sm font-medium uppercase tracking-wide text-[var(--nw-ink)]/60"
      >
        Partner szűrés
      </label>
      <p className="mt-1 text-sm text-[var(--nw-ink)]/55">
        Keresés név vagy adószám szerint — kiválasztás után csak ez a partner jelenik meg.
      </p>

      <div className="relative mt-3">
        <input
          id={listId}
          type="text"
          autoComplete="off"
          placeholder="pl. Pannon, HU2648…"
          value={query}
          onChange={(e) => {
            const v = e.target.value;
            setQuery(v);
            setOpen(true);
            if (selected) onSelect(null);
          }}
          onFocus={() => setOpen(true)}
          className={[
            'w-full rounded-sm border border-[var(--nw-ink)]/20 bg-white/50 py-2.5 pl-3 text-[var(--nw-ink)] outline-none placeholder:text-[var(--nw-ink)]/40 focus:border-[var(--nw-sky)]',
            selected ? 'pr-16' : 'pr-3',
          ].join(' ')}
        />

        {selected && (
          <button
            type="button"
            className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer text-sm text-[var(--nw-sky)] hover:underline"
            onClick={() => {
              onSelect(null);
              setQuery('');
              setOpen(false);
            }}
          >
            Törlés
          </button>
        )}
      </div>

      {showList && (
        <ul
          role="listbox"
          className="absolute z-30 mt-1 max-h-64 w-full overflow-auto rounded-sm border border-[var(--nw-ink)]/15 bg-[var(--nw-mist)] shadow-md"
        >
          {suggestions.map((p) => (
            <li key={p.key}>
              <button
                type="button"
                role="option"
                className="flex w-full cursor-pointer flex-col px-3 py-2 text-left hover:bg-[var(--nw-sky)]/10"
                onClick={() => {
                  onSelect(p);
                  setQuery(p.label);
                  setOpen(false);
                }}
              >
                <span className="whitespace-nowrap text-sm font-medium uppercase">
                  {p.label}
                </span>
                {p.tax_id && (
                  <span className="font-mono text-xs text-[var(--nw-ink)]/50">
                    {p.tax_id}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      {open && !selected && query.trim() && suggestions.length === 0 && (
        <p className="mt-2 text-sm text-[var(--nw-ink)]/55">Nincs találat.</p>
      )}
    </div>
  );
}
