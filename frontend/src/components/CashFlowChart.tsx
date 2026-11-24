import type { MonthlyPoint } from '../types';

interface CashFlowChartProps {
  months: MonthlyPoint[];
}

function formatAxis(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} M`;
  if (n >= 1000) return `${Math.round(n / 1000)} e`;
  return String(Math.round(n));
}

export default function CashFlowChart({ months }: CashFlowChartProps) {
  if (months.length === 0) {
    return (
      <section className="mt-12">
        <h2 className="text-sm font-medium uppercase tracking-wide text-[var(--nw-ink)]/60">
          Fizetési határidő szerint (havi)
        </h2>
        <p className="mt-4 text-[var(--nw-ink)]/55">
          Nincs még feldolgozott számla a diagramhoz.
        </p>
      </section>
    );
  }

  const w = 720;
  const h = 280;
  const pad = { top: 24, right: 16, bottom: 40, left: 56 };
  const innerW = w - pad.left - pad.right;
  const innerH = h - pad.top - pad.bottom;

  const maxY = Math.max(
    1,
    ...months.map((m) => Math.max(m.incoming, m.outgoing)),
  );
  const xAt = (i: number) =>
    pad.left + (months.length === 1 ? innerW / 2 : (i / (months.length - 1)) * innerW);
  const yAt = (v: number) => pad.top + innerH - (v / maxY) * innerH;

  const linePath = (key: 'incoming' | 'outgoing') =>
    months
      .map((m, i) => `${i === 0 ? 'M' : 'L'} ${xAt(i).toFixed(1)} ${yAt(m[key]).toFixed(1)}`)
      .join(' ');

  const ticks = 4;
  const yTicks = Array.from({ length: ticks + 1 }, (_, i) => (maxY * i) / ticks);

  return (
    <section className="mt-12">
      <h2 className="text-sm font-medium uppercase tracking-wide text-[var(--nw-ink)]/60">
        Fizetési határidő szerint (havi)
      </h2>
      <p className="mt-1 text-sm text-[var(--nw-ink)]/55">
        Bruttó összegek forintban, due date hónapokra bontva.
      </p>

      <div className="mt-4 overflow-x-auto">
        <svg
          viewBox={`0 0 ${w} ${h}`}
          className="min-w-[36rem] w-full max-w-4xl"
          role="img"
          aria-label="Havi bejövő és kimenő HUF vonaldiagram"
        >
          {yTicks.map((t) => (
            <g key={t}>
              <line
                x1={pad.left}
                x2={w - pad.right}
                y1={yAt(t)}
                y2={yAt(t)}
                stroke="currentColor"
                strokeOpacity={0.12}
              />
              <text
                x={pad.left - 8}
                y={yAt(t) + 4}
                textAnchor="end"
                className="fill-[var(--nw-ink)]"
                fontSize="11"
              >
                {formatAxis(t)}
              </text>
            </g>
          ))}

          <path d={linePath('incoming')} fill="none" stroke="#1a6b9a" strokeWidth="2.5" />
          <path d={linePath('outgoing')} fill="none" stroke="#b45309" strokeWidth="2.5" />

          {months.map((m, i) => (
            <g key={m.month}>
              <circle cx={xAt(i)} cy={yAt(m.incoming)} r="3.5" fill="#1a6b9a" />
              <circle cx={xAt(i)} cy={yAt(m.outgoing)} r="3.5" fill="#b45309" />
              <text
                x={xAt(i)}
                y={h - 12}
                textAnchor="middle"
                fontSize="11"
                className="fill-[var(--nw-ink)]"
              >
                {m.month}
              </text>
            </g>
          ))}

          <g transform={`translate(${pad.left}, 8)`}>
            <rect x="0" y="0" width="10" height="3" fill="#1a6b9a" />
            <text x="16" y="4" fontSize="12" className="fill-[var(--nw-ink)]">
              Bejövő
            </text>
            <rect x="90" y="0" width="10" height="3" fill="#b45309" />
            <text x="106" y="4" fontSize="12" className="fill-[var(--nw-ink)]">
              Kimenő
            </text>
          </g>
        </svg>
      </div>
    </section>
  );
}
