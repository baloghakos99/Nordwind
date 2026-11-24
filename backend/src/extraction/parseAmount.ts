import type { CurrencyCode } from '../types/domain.js';
import type { ParsedAmountHit } from '../types/invoice.js';

const CURRENCY_SYMBOLS: { re: RegExp; code: CurrencyCode }[] = [
  { re: /€|eur\b/i, code: 'EUR' },
  { re: /\$|usd\b/i, code: 'USD' },
  { re: /£|gbp\b/i, code: 'GBP' },
  { re: /\bpln\b|zł|zl\b/i, code: 'PLN' },
  { re: /\bhuf\b|\bft\b|forint/i, code: 'HUF' },
];

export function detectCurrency(
  fragment: string | null | undefined,
  fallback: CurrencyCode | null = null,
): CurrencyCode | null {
  if (!fragment) return fallback;
  for (const { re, code } of CURRENCY_SYMBOLS) {
    if (re.test(fragment)) return code;
  }
  return fallback;
}

/**
 * Parse localized money string → number or null.
 * Handles: 1 234,56 | 1.234,56 | 1,234.56 | 186 639 | 889.09
 */
export function parseAmount(raw: string | number | null | undefined): number | null {
  if (raw == null) return null;
  let s = String(raw).trim();
  s = s.replace(/(?:€|\$|£|zł|Ft|HUF|EUR|USD|GBP|PLN)\s*$/i, '').trim();
  s = s.replace(/^(?:€|\$|£)/, '').trim();
  s = s.replace(/\s/g, '');
  if (!s) return null;

  const hasComma = s.includes(',');
  const hasDot = s.includes('.');

  if (hasComma && hasDot) {
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
      // 1.234,56
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      // 1,234.56
      s = s.replace(/,/g, '');
    }
  } else if (hasComma) {
    const parts = s.split(',');
    if (parts.length === 2 && parts[1].length <= 2) {
      s = `${parts[0].replace(/\./g, '')}.${parts[1]}`;
    } else {
      s = s.replace(/,/g, '');
    }
  } else if (hasDot) {
    const parts = s.split('.');
    if (parts.length > 2) {
      // 1.086.00 unlikely; treat dots as thousand except last if 2 digits
      const last = parts[parts.length - 1];
      if (last.length === 2) {
        s = parts.slice(0, -1).join('') + '.' + last;
      } else {
        s = parts.join('');
      }
    } else if (parts.length === 2 && parts[1].length === 3 && parts[0].length <= 3) {
      // 1.086 German thousands without decimals → 1086
      s = parts.join('');
    }
  }

  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

const AMOUNT_TOKEN_RE =
  /(?:€|\$|£)?\s*\d{1,3}(?:[.,\s]\d{3})+(?:[.,]\d{2})?|(?:€|\$|£)?\s*\d+[.,]\d{2}|(?:€|\$|£)?\s*\d{1,3}(?:\s\d{3})+|(?:€|\$|£)?\s*\d+/;

/**
 * Amount after a payable label. Walks matches from the end; skips 0 (VAT total noise).
 */
export function findAmountNear(text: string, labelRegex: RegExp): ParsedAmountHit | null {
  const re = new RegExp(
    labelRegex.source,
    labelRegex.flags.includes('i') ? labelRegex.flags : `${labelRegex.flags}i`,
  );
  const matches = [...text.matchAll(new RegExp(re.source, `${re.flags}g`))];
  if (matches.length === 0) return null;

  for (let i = matches.length - 1; i >= 0; i--) {
    const m = matches[i];
    if (m.index == null) continue;
    const window = text.slice(m.index + m[0].length, m.index + m[0].length + 60);
    const amountMatch = window.match(AMOUNT_TOKEN_RE);
    if (!amountMatch) continue;
    const amount = parseAmount(amountMatch[0]);
    if (amount == null || amount <= 0) continue;
    const currency = detectCurrency(window) || detectCurrency(m[0]);
    return { amount, currency, raw: amountMatch[0] };
  }
  return null;
}

/**
 * Last positive money-looking token in the document tail (label-agnostic fallback).
 */
export function findLastPositiveAmount(text: string, tailChars = 500): ParsedAmountHit | null {
  const start = Math.max(0, text.length - tailChars);
  const tail = text.slice(start);
  const matches = [...tail.matchAll(new RegExp(AMOUNT_TOKEN_RE.source, 'g'))];
  for (let i = matches.length - 1; i >= 0; i--) {
    const raw = matches[i][0];
    const amount = parseAmount(raw);
    if (amount == null || amount <= 0) continue;
    // Prefer amounts that look like totals (have decimals or thousands), skip tiny line qtys
    if (amount < 1) continue;
    const currency = detectCurrency(raw) || detectCurrency(tail.slice(Math.max(0, (matches[i].index ?? 0) - 20), (matches[i].index ?? 0) + raw.length + 10));
    return { amount, currency, raw };
  }
  return null;
}
