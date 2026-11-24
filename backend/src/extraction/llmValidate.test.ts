import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  amountAppearsInText,
  assertLlmJsonShape,
  crossCheckLlmAgainstSource,
  LLM_FIELD_KEYS,
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
