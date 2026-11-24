import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  amountAppearsInText,
  assertLlmJsonShape,
  checkLineItemsSumGross,
  crossCheckLlmAgainstSource,
  LLM_FIELD_KEYS,
  parseLineItemAmounts,
  parseVatAmount,
} from './llmValidate.js';
import type { ExtractedInvoiceFields } from '../types/invoice.js';

function baseFields(partial: Partial<ExtractedInvoiceFields> = {}): ExtractedInvoiceFields {
  return {
    invoice_number: 'NWS/2026/0044',
    issuer_name: 'Nordwind Solutions Kft.',
    issuer_tax_id: 'HU26481937',
    buyer_name: 'Partner Ltd',
    buyer_tax_id: 'GB123',
    issue_date: '2026-10-15',
    fulfillment_date: '2026-10-14',
    due_date: '2026-10-30',
    currency: 'GBP',
    gross_amount: 8743,
    direction: 'outgoing',
    partner_name: 'Partner Ltd',
    partner_tax_id: 'GB123',
    ...partial,
  };
}

describe('assertLlmJsonShape', () => {
  it('accepts object with all keys', () => {
    const raw: Record<string, unknown> = {};
    for (const k of LLM_FIELD_KEYS) raw[k] = null;
    raw.gross_amount = 100;
    raw.direction = 'incoming';
    assert.doesNotThrow(() => assertLlmJsonShape(raw));
  });

  it('rejects missing keys', () => {
    assert.throws(() => assertLlmJsonShape({ invoice_number: 'X' }), /missing keys/i);
  });

  it('rejects non-object', () => {
    assert.throws(() => assertLlmJsonShape([]), /JSON object/i);
  });

  it('accepts optional line_item_amounts array or null', () => {
    const raw: Record<string, unknown> = {};
    for (const k of LLM_FIELD_KEYS) raw[k] = null;
    raw.line_item_amounts = [10, 20];
    assert.doesNotThrow(() => assertLlmJsonShape(raw));
    raw.line_item_amounts = null;
    assert.doesNotThrow(() => assertLlmJsonShape(raw));
  });

  it('rejects bad line_item_amounts type', () => {
    const raw: Record<string, unknown> = {};
    for (const k of LLM_FIELD_KEYS) raw[k] = null;
    raw.line_item_amounts = 'nope';
    assert.throws(() => assertLlmJsonShape(raw), /line_item_amounts/i);
  });

  it('accepts optional vat_amount number or null', () => {
    const raw: Record<string, unknown> = {};
    for (const k of LLM_FIELD_KEYS) raw[k] = null;
    raw.vat_amount = 53557;
    assert.doesNotThrow(() => assertLlmJsonShape(raw));
    raw.vat_amount = null;
    assert.doesNotThrow(() => assertLlmJsonShape(raw));
  });
});

describe('parseLineItemAmounts', () => {
  it('returns empty for missing or non-array', () => {
    assert.deepEqual(parseLineItemAmounts(undefined), []);
    assert.deepEqual(parseLineItemAmounts(null), []);
    assert.deepEqual(parseLineItemAmounts('x'), []);
  });

  it('parses numbers and numeric strings', () => {
    assert.deepEqual(parseLineItemAmounts([100, '50.5', '  10  ']), [100, 50.5, 10]);
  });
});

describe('parseVatAmount', () => {
  it('parses number or string, else 0', () => {
    assert.equal(parseVatAmount(53557), 53557);
    assert.equal(parseVatAmount('53 557'), 53557);
    assert.equal(parseVatAmount(null), 0);
  });
});

describe('checkLineItemsSumGross', () => {
  it('skips when no line amounts', () => {
    assert.deepEqual(checkLineItemsSumGross([], 100), []);
    assert.deepEqual(checkLineItemsSumGross(null, 100), []);
  });

  it('skips when gross missing', () => {
    assert.deepEqual(checkLineItemsSumGross([50, 50], null), []);
    assert.deepEqual(checkLineItemsSumGross([50, 50], 0), []);
  });

  it('passes when sum within tolerance', () => {
    assert.deepEqual(checkLineItemsSumGross([50, 50], 100), []);
    assert.deepEqual(checkLineItemsSumGross([99.5, 0.6], 100), []); // tol ≥ 1
  });

  it('passes net lines + separate vat ≈ gross (HU-style)', () => {
    // 135000+19300+21420+22640 = 198360; + ÁFA 53557 = 251917
    assert.deepEqual(
      checkLineItemsSumGross([135000, 19300, 21420, 22640], 251917, 53557),
      [],
    );
  });

  it('fails net-only when vat omitted but gross includes vat', () => {
    const errs = checkLineItemsSumGross([135000, 19300, 21420, 22640], 251917, 0);
    assert.ok(errs.some((e) => /line_item_amounts\+vat/i.test(e)));
  });

  it('fails when sum mismatches gross', () => {
    const errs = checkLineItemsSumGross([10, 20], 100);
    assert.ok(errs.some((e) => /line_item_amounts\+vat/i.test(e)));
  });
});

describe('crossCheckLlmAgainstSource', () => {
  const source = `
    Számlaszám: NWS/2026/0044
    Pénznem GBP
    Fizetendő 8 743,00 GBP
  `;

  it('passes when invoice #, currency, amount in text', () => {
    assert.deepEqual(crossCheckLlmAgainstSource(baseFields(), source), []);
  });

  it('fails when invoice number hallucinated', () => {
    const errs = crossCheckLlmAgainstSource(baseFields({ invoice_number: 'ZZZ-999' }), source);
    assert.ok(errs.some((e) => /invoice_number/i.test(e)));
  });

  it('fails when gross amount missing from text', () => {
    const errs = crossCheckLlmAgainstSource(baseFields({ gross_amount: 999999 }), source);
    assert.ok(errs.some((e) => /gross_amount/i.test(e)));
  });
});

describe('amountAppearsInText', () => {
  it('finds spaced HU-style amounts', () => {
    assert.equal(amountAppearsInText(8743, '8 743,00 GBP'), true);
    assert.equal(amountAppearsInText(11353, '11 353,00 €'), true);
  });
});
