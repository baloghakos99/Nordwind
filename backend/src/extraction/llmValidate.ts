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
 * We do not extract line items — instead verify key claims appear in the source.
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
