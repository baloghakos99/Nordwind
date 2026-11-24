import type { PartnerMatrix } from '../types';
import { splitNameTwoLines } from '../lib/splitNameTwoLines';

interface PartnerTableProps {
  matrix: PartnerMatrix;
}

function formatHuf(n: number): string {
  return `${new Intl.NumberFormat('hu-HU', {
    maximumFractionDigits: 0,
  }).format(n)} HUF`;
}

export default function PartnerTable({ matrix }: PartnerTableProps) {
  const { partners, incoming, outgoing } = matrix;
  const single = partners.length === 1;

  return (
    <section className="mt-12">
      <h2 className="text-sm font-medium uppercase tracking-wide text-[var(--nw-ink)]/60">
        Cégenkénti összesítő
      </h2>
      <p className="mt-1 text-sm text-[var(--nw-ink)]/55">
        Partnerek adószám szerint; összegek bruttó HUF.
      </p>

      {partners.length === 0 ? (
        <p className="mt-4 text-[var(--nw-ink)]/55">Nincs partner adat.</p>
      ) : single ? (
        <div className="mt-4 max-w-md">
          <p
            className="whitespace-nowrap font-medium uppercase"
            title={partners[0].tax_id || undefined}
          >
            {partners[0].label}
          </p>
          {partners[0].tax_id && (
            <p className="mt-0.5 font-mono text-xs text-[var(--nw-ink)]/50">
              {partners[0].tax_id}
            </p>
          )}
          <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-8 gap-y-2 text-sm">
            <dt className="font-semibold">Össz bejövő</dt>
            <dd className="text-right tabular-nums">{formatHuf(incoming[0])}</dd>
            <dt className="font-semibold">Össz kimenő</dt>
            <dd className="text-right tabular-nums">{formatHuf(outgoing[0])}</dd>
          </dl>
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-max min-w-0 border-collapse text-sm">
            <thead>
              <tr className="border-b border-[var(--nw-ink)]/20 text-left">
                <th className="sticky left-0 z-10 bg-[var(--nw-mist)] py-2 pr-4 font-medium">
                  Irány
                </th>
                {partners.map((p) => (
                  <th
                    key={p.key}
                    className="px-3 py-2 align-bottom font-medium uppercase leading-snug"
                    title={p.tax_id || undefined}
                  >
                    {splitNameTwoLines(p.label).map((line, i) => (
                      <div key={i} className="whitespace-nowrap">
                        {line}
                      </div>
                    ))}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-[var(--nw-ink)]/10">
                <th className="sticky left-0 z-10 bg-[var(--nw-mist)] py-2 pr-4 text-left font-semibold">
                  Össz bejövő
                </th>
                {incoming.map((v, i) => (
                  <td key={partners[i].key} className="px-3 py-2 text-right tabular-nums">
                    {formatHuf(v)}
                  </td>
                ))}
              </tr>
              <tr>
                <th className="sticky left-0 z-10 bg-[var(--nw-mist)] py-2 pr-4 text-left font-semibold">
                  Össz kimenő
                </th>
                {outgoing.map((v, i) => (
                  <td key={partners[i].key} className="px-3 py-2 text-right tabular-nums">
                    {formatHuf(v)}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
