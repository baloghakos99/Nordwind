import type { IsoDate } from '../types/domain.js';

const MONTHS: Record<string, number> = {
  // EN
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
  jan: 1, feb: 2, mar: 3, apr: 4, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
  // HU (ASCII + accented keys; NFD strip uses ASCII lookup)
  januar: 1, 'január': 1, februar: 2, 'február': 2, marcius: 3, 'március': 3,
  aprilis: 4, 'április': 4, majus: 5, 'május': 5, junius: 6, 'június': 6,
  julius: 7, 'július': 7, augusztus: 8, szeptember: 9, oktober: 10, 'október': 10,
  // DE (august/september/oktober share EN/HU keys after NFD)
  marz: 3, 'märz': 3, mai: 5, juni: 6, juli: 7, dezember: 12,
  // FR (mai shares DE key)
  janvier: 1, fevrier: 2, 'février': 2, mars: 3, avril: 4, juin: 6,
  juillet: 7, aout: 8, 'août': 8, septembre: 9, octobre: 10,
  novembre: 11, decembre: 12, 'décembre': 12,
  // NL (juni/juli/oktober/september… share DE/EN/HU keys)
  januari: 1, februari: 2, maart: 3, mei: 5, augustus: 8,
  // ES
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6,
  julio: 7, agosto: 8, septiembre: 9, setiembre: 9, noviembre: 11, diciembre: 12,
  // IT
  gennaio: 1, febbraio: 2, aprile: 4, maggio: 5, giugno: 6,
  luglio: 7, settembre: 9, ottobre: 10, dicembre: 12,
  // PL
  stycznia: 1, lutego: 2, marca: 3, kwietnia: 4, maja: 5, czerwca: 6,
  lipca: 7, sierpnia: 8, wrzesnia: 9, 'września': 9, pazdziernika: 10, 'października': 10,
  listopada: 11, grudnia: 12,
};

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function iso(y: number, m: number, d: number): IsoDate | null {
  if (!y || !m || !d) return null;
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const year = y < 100 ? 2000 + y : y;
  if (year < 1990 || year > 2100) return null;
  return `${year}-${pad(m)}-${pad(d)}`;
}

function monthFromName(name: string | null | undefined): number | null {
  if (!name) return null;
  const key = name.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
  return MONTHS[key] || MONTHS[name.toLowerCase()] || null;
}

/**
 * Parse a date string in many EU/US formats → YYYY-MM-DD or null.
 */
export function parseDate(raw: string | null | undefined): IsoDate | null {
  if (!raw) return null;
  const s = String(raw).trim().replace(/\s+/g, ' ');

  let m = s.match(/^(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})\.?$/);
  if (m) return iso(+m[1], +m[2], +m[3]);

  m = s.match(/^(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{2,4})\.?$/);
  if (m) {
    const a = +m[1];
    const b = +m[2];
    const y = +m[3];
    // Prefer D.M.Y (EU) when both plausible
    if (a > 12) return iso(y, b, a);
    if (b > 12) return iso(y, a, b);
    return iso(y, b, a);
  }

  // 2026. július 16. / 2026. julius 16
  m = s.match(/^(\d{4})\.?\s+([A-Za-zÀ-öø-ÿŐőŰű]+)\s+(\d{1,2})\.?$/i);
  if (m) {
    const mo = monthFromName(m[2]);
    if (mo) return iso(+m[1], mo, +m[3]);
  }

  // 18. August 2026 / 15 mars 2026 / 15 lipca 2026 (optional day-dot)
  m = s.match(/^(\d{1,2})\.?\s+([A-Za-zÀ-öø-ÿŐőŰű]+)\s+(\d{4})$/i);
  if (m) {
    const mo = monthFromName(m[2]);
    if (mo) return iso(+m[3], mo, +m[1]);
  }

  // March 15, 2026 / May 1, 2026
  m = s.match(/^([A-Za-zÀ-öø-ÿ]+)\s+(\d{1,2}),?\s+(\d{4})$/i);
  if (m) {
    const mo = monthFromName(m[1]);
    if (mo) return iso(+m[3], mo, +m[2]);
  }

  // 15.08.2026 (already covered) / trailing junk after date on same token
  m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})\b/);
  if (m) {
    const a = +m[1];
    const b = +m[2];
    const y = +m[3];
    if (a > 12) return iso(y, b, a);
    if (b > 12) return iso(y, a, b);
    return iso(y, b, a);
  }

  return null;
}

/** Find first parseable date in text near a label match. */
export function findDateAfter(text: string, labelRegex: RegExp): IsoDate | null {
  const re = new RegExp(
    labelRegex.source,
    labelRegex.flags.includes('i') ? labelRegex.flags : `${labelRegex.flags}i`,
  );
  const m = text.match(re);
  if (!m || m.index == null) return null;
  const from = m.index + m[0].length;
  const window = text.slice(from, from + 80);
  const candidates = window.match(
    /\d{4}[.\-/]\d{1,2}[.\-/]\d{1,2}\.?|\d{1,2}[.\-/]\d{1,2}[.\-/]\d{2,4}\.?|\d{4}\.?\s+[A-Za-zÀ-öø-ÿŐőŰű]+\s+\d{1,2}\.?|[A-Za-zÀ-öø-ÿ]+\s+\d{1,2},?\s+\d{4}|\d{1,2}\.?\s+[A-Za-zÀ-öø-ÿŐőŰű]+\s+\d{4}/g,
  );
  if (!candidates) return null;
  for (const c of candidates) {
    const d = parseDate(c);
    if (d) return d;
  }
  return null;
}
