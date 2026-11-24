import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { ExtractedInvoiceFields } from '../types/invoice.js';
import {
  isPlausibleInvoiceNumber,
  isPlausibleTaxId,
  validateExtraction,
} from './validate.js';

function base(over: Partial<ExtractedInvoiceFields> = {}): ExtractedInvoiceFields {
  return {
    invoice_number: 'PI-26-0057',
    issuer_name: 'Pannon Irodaszer Kft.',
    issuer_tax_id: 'HU23918466',
    buyer_name: 'Nordwind Solutions Kft.',
    buyer_tax_id: '26481937-2-43',
    issue_date: '2026-09-10',
    fulfillment_date: '2026-09-05',
    due_date: '2026-09-25',
    currency: 'HUF',
    gross_amount: 1000,
    direction: 'incoming',
    partner_name: 'Pannon Irodaszer Kft.',
    partner_tax_id: 'HU23918466',
    ...over,
  };
}

describe('isPlausibleInvoiceNumber', () => {
  it('rejects slash-only and shorter than 3 chars', () => {
    assert.equal(isPlausibleInvoiceNumber('/'), false);
    assert.equal(isPlausibleInvoiceNumber('AB'), false);
    assert.equal(isPlausibleInvoiceNumber('A1'), false);
  });
  it('accepts normal numbers (min 3 alnum)', () => {
    assert.equal(isPlausibleInvoiceNumber('ABC'), true);
    assert.equal(isPlausibleInvoiceNumber('NWS-2026-0044'), true);
  });
});

describe('isPlausibleTaxId', () => {
  it('accepts HU / EU / EIN', () => {
    assert.equal(isPlausibleTaxId('26481937-2-43'), true);
    assert.equal(isPlausibleTaxId('HU26481937'), true);
    assert.equal(isPlausibleTaxId('84-3920175'), true);
  });
  it('rejects garbage', () => {
    assert.equal(isPlausibleTaxId('not-a-tax'), false);
    assert.equal(isPlausibleTaxId('SZÁMLA'), false);
  });
});

describe('validateExtraction quality gates', () => {
  it('passes a normal incoming invoice', () => {
    assert.equal(validateExtraction(base()).ok, true);
  });

  it('passes a normal outgoing invoice', () => {
    const v = validateExtraction(base({
      issuer_name: 'Nordwind Solutions Kft.',
      issuer_tax_id: 'HU26481937',
      buyer_name: 'Client GmbH',
      buyer_tax_id: 'DE123456789',
      direction: 'outgoing',
      partner_name: 'Client GmbH',
      partner_tax_id: 'DE123456789',
    }));
    assert.equal(v.ok, true);
  });

  it('fails invoice_number "/"', () => {
    const v = validateExtraction(base({ invoice_number: '/' }));
    assert.equal(v.ok, false);
    assert.ok(v.errors.some((e) => e.includes('invoice_number')));
  });

  it('fails partner_name SZÁMLA / INVOICE', () => {
    const v = validateExtraction(base({ partner_name: 'SZÁMLA / INVOICE' }));
    assert.equal(v.ok, false);
  });

  it('fails when partner is Nordwind', () => {
    const v = validateExtraction(base({
      partner_name: 'Nordwind Solutions Kft.',
      partner_tax_id: 'HU26481937',
    }));
    assert.equal(v.ok, false);
  });

  it('fails when direction does not match Nordwind side', () => {
    const v = validateExtraction(base({ direction: 'outgoing' }));
    assert.equal(v.ok, false);
    assert.ok(v.errors.some((e) => e.includes('direction')));
  });

  it('fails when issuer equals buyer', () => {
    const v = validateExtraction(base({
      buyer_name: 'Pannon Irodaszer Kft.',
      buyer_tax_id: 'HU23918466',
      direction: 'incoming',
    }));
    assert.equal(v.ok, false);
    assert.ok(v.errors.some((e) => e.includes('same party')));
  });

  it('fails due_date before issue_date', () => {
    const v = validateExtraction(base({
      issue_date: '2026-09-20',
      due_date: '2026-09-10',
    }));
    assert.equal(v.ok, false);
    assert.ok(v.errors.some((e) => e.includes('due_date is before')));
  });

  it('fails identical issue/fulfillment/due', () => {
    const v = validateExtraction(base({
      issue_date: '2026-09-10',
      fulfillment_date: '2026-09-10',
      due_date: '2026-09-10',
    }));
    assert.equal(v.ok, false);
    assert.ok(v.errors.some((e) => e.includes('identical')));
  });

  it('fails out-of-range date', () => {
    const v = validateExtraction(base({ issue_date: '1999-01-01' }));
    assert.equal(v.ok, false);
  });

  it('fails address-like issuer name', () => {
    const v = validateExtraction(base({ issuer_name: 'Infopark sétány 7.' }));
    assert.equal(v.ok, false);
  });

  it('fails implausible tax id when present', () => {
    const v = validateExtraction(base({ issuer_tax_id: 'not-a-tax' }));
    assert.equal(v.ok, false);
  });
});
