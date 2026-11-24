import type { PartnerMatrix } from '../types';

interface PartnerTableProps {
  matrix: PartnerMatrix;
}

function formatHuf(n: number): string {
  return new Intl.NumberFormat('hu-HU', {
    maximumFractionDigits: 0,
  }).format(n);
}

export default function PartnerTable({ matrix }: PartnerTableProps) {
  const { partners, incoming, outgoing } = matrix;

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
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-[var(--nw-ink)]/20 text-left">
                <th className="sticky left-0 bg-[var(--nw-sand)] py-2 pr-4 font-medium">
                  Irány
                </th>
                {partners.map((p) => (
                  <th
                    key={p.key}
                    className="px-3 py-2 font-medium whitespace-nowrap"
                    title={p.tax_id || undefined}
                  >
                    {p.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-[var(--nw-ink)]/10">
                <th className="sticky left-0 bg-[var(--nw-mist)]/80 py-2 pr-4 text-left font-semibold">
                  Össz bejövő
                </th>
                {incoming.map((v, i) => (
                  <td key={partners[i].key} className="px-3 py-2 text-right tabular-nums">
                    {formatHuf(v)}
                  </td>
                ))}
              </tr>
              <tr>
                <th className="sticky left-0 bg-[var(--nw-mist)]/80 py-2 pr-4 text-left font-semibold">
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
