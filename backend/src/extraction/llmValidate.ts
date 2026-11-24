import type { ExtractedInvoiceFields } from '../types/invoice.js';

/** Keys the model must return (values may be null). */
export const LLM_FIELD_KEYS = [
  'invoice_number',
  'issuer_name',
  'issuer_tax_id',
  'buyer_name',
  'buyer_tax_id',
  'issue_date',
  'fulfillment_date',
  'due_date',
  'currency',
  'gross_amount',
  'direction',
  'partner_name',
  'partner_tax_id',
] as const;

/**
 * Structural check on raw LLM JSON before normalize.
 * Requires an object with all expected keys present (null allowed).
 */
export function assertLlmJsonShape(raw: unknown): asserts raw is Record<string, unknown> {
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('LLM payload must be a JSON object');
  }
  const o = raw as Record<string, unknown>;
  const missing = LLM_FIELD_KEYS.filter((k) => !(k in o));
  if (missing.length) {
    throw new Error(`LLM JSON missing keys: ${missing.join(', ')}`);
  }
  if (o.gross_amount != null && typeof o.gross_amount !== 'number' && typeof o.gross_amount !== 'string') {
    throw new Error('LLM gross_amount must be number, string, or null');
  }
  if (
    o.direction != null
    && o.direction !== 'incoming'
    && o.direction !== 'outgoing'
    && o.direction !== 'bejövő'
    && o.direction !== 'kimenő'
  ) {
    throw new Error(`LLM direction invalid: ${String(o.direction)}`);
  }
  // Optional soft-check fields — not required
  if ('line_item_amounts' in o && o.line_item_amounts != null) {
    if (!Array.isArray(o.line_item_amounts)) {
      throw new Error('LLM line_item_amounts must be an array or null');
    }
    for (const item of o.line_item_amounts) {
      if (typeof item !== 'number' && typeof item !== 'string') {
        throw new Error('LLM line_item_amounts entries must be number or string');
      }
    }
  }
  if ('vat_amount' in o && o.vat_amount != null
    && typeof o.vat_amount !== 'number' && typeof o.vat_amount !== 'string') {
    throw new Error('LLM vat_amount must be number, string, or null');
  }
}

function parseOptionalPositiveNumber(raw: unknown): number | null {
  if (raw == null) return null;
  if (typeof raw === 'number' && Number.isFinite(raw) && raw >= 0) return raw;
  if (typeof raw === 'string') {
    const t = raw.trim().replace(/\s/g, '').replace(',', '.');
    const parsed = Number(t);
    if (Number.isFinite(parsed) && parsed >= 0) return parsed;
  }
  return null;
}

/**
 * Parse optional LLM `line_item_amounts` into finite numbers.
 * Missing / null / non-array → empty (soft check skipped).
 */
export function parseLineItemAmounts(raw: unknown): number[] {
  if (raw == null || !Array.isArray(raw)) return [];
  const out: number[] = [];
  for (const item of raw) {
    const n = parseOptionalPositiveNumber(item);
    if (n != null && n > 0) out.push(n);
  }
  return out;
}

/** Optional total VAT (ÁFA összesen). Missing / invalid → 0 for the soft check. */
export function parseVatAmount(raw: unknown): number {
  return parseOptionalPositiveNumber(raw) ?? 0;
}

/**
 * Soft check: if ≥1 line amounts, sum(lines) + vat ≈ gross (tol = max(1, 1% of gross)).
 * Lines are often NET; vat_amount is the separate VAT total when listed.
 * Empty / missing amounts or missing gross → skip (no errors).
 */
export function checkLineItemsSumGross(
  lineAmounts: number[] | null | undefined,
  grossAmount: number | null | undefined,
  vatAmount: number | null | undefined = 0,
): string[] {
  if (!lineAmounts || lineAmounts.length === 0) return [];
  if (grossAmount == null || !(grossAmount > 0) || !Number.isFinite(grossAmount)) return [];
  const vat = vatAmount != null && Number.isFinite(vatAmount) && vatAmount > 0 ? vatAmount : 0;
  const sum = lineAmounts.reduce((a, b) => a + b, 0) + vat;
  const tol = Math.max(1, 0.01 * Math.abs(grossAmount));
  if (Math.abs(sum - grossAmount) <= tol) return [];
  return [
    `LLM line_item_amounts+vat ${sum} ≠ gross_amount ${grossAmount} (lines+vat, tol ${tol})`,
  ];
}

function compactAlnum(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function digitsOnly(s: string): string {
  return s.replace(/\D/g, '');
}

/** True if amount's integer part (or cent value) appears among source digits. */
export function amountAppearsInText(amount: number, sourceText: string): boolean {
  if (!Number.isFinite(amount) || amount <= 0) return false;
  const dig = digitsOnly(sourceText);
  const intPart = String(Math.floor(Math.abs(amount)));
  if (intPart.length >= 3 && dig.includes(intPart)) return true;
  const cents = String(Math.round(Math.abs(amount) * 100));
  if (cents.length >= 4 && dig.includes(cents)) return true;
  return false;
}

/**
 * Cross-check normalized LLM fields against PDF text.
 * Header claims must appear in the source; optional line-item sum is separate.
 * Returns error messages (empty = ok).
 */
export function crossCheckLlmAgainstSource(
  fields: ExtractedInvoiceFields,
  sourceText: string,
): string[] {
  const errors: string[] = [];
  const compact = compactAlnum(sourceText);

  if (fields.invoice_number) {
    const needle = compactAlnum(fields.invoice_number);
    if (needle.length >= 3 && !compact.includes(needle)) {
      errors.push(`LLM invoice_number not found in source: "${fields.invoice_number}"`);
    }
  }

  if (fields.currency) {
    const cur = fields.currency.toUpperCase();
    const symbols: Record<string, RegExp> = {
      EUR: /€|\beur\b/i,
      USD: /\$|\busd\b/i,
      GBP: /£|\bgbp\b/i,
      HUF: /\bhuf\b|\bft\b|forint/i,
      PLN: /\bpln\b|zł/i,
    };
    const re = symbols[cur];
    if (re && !re.test(sourceText) && !sourceText.toUpperCase().includes(cur)) {
      errors.push(`LLM currency ${cur} not found in source`);
    }
  }

  if (fields.gross_amount != null && fields.gross_amount > 0) {
    if (!amountAppearsInText(fields.gross_amount, sourceText)) {
      errors.push(`LLM gross_amount ${fields.gross_amount} not found in source text`);
    }
  }

  return errors;
}
