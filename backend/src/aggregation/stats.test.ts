import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { InvoiceRow } from '../types/invoice.js';
import { buildInvoiceStats } from './stats.js';

function row(partial: Partial<InvoiceRow> & Pick<InvoiceRow, 'id' | 'status'>): InvoiceRow {
  return {
    source_filename: null,
    stored_path: null,
    file_hash: null,
    error_message: null,
    invoice_number: null,
    issuer_name: null,
    issuer_tax_id: null,
    buyer_name: null,
    buyer_tax_id: null,
    issue_date: null,
    fulfillment_date: null,
    due_date: null,
    currency: null,
    gross_amount: null,
    direction: null,
    partner_name: null,
    partner_tax_id: null,
    extraction_method: null,
    mnb_rate: null,
    mnb_rate_date: null,
    amount_huf: null,
    created_at: '',
    updated_at: '',
    ...partial,
  };
}

describe('buildInvoiceStats', () => {
  it('counts statuses and extraction methods', () => {
    const s = buildInvoiceStats([
      row({ id: 1, status: 'pending' }),
      row({ id: 2, status: 'processing' }),
      row({ id: 3, status: 'done', extraction_method: 'rules' }),
      row({ id: 4, status: 'done', extraction_method: 'llm' }),
      row({ id: 5, status: 'error' }),
    ]);
    assert.equal(s.total, 5);
    assert.equal(s.pending, 1);
    assert.equal(s.processing, 1);
    assert.equal(s.done, 2);
    assert.equal(s.error, 1);
    assert.equal(s.done_rules, 1);
    assert.equal(s.done_llm, 1);
    assert.equal(s.busy, 2);
    assert.equal(s.progress, 3 / 5);
  });
});
