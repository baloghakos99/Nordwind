import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { InvoiceRow } from '../types/invoice.js';
import {
  buildMonthlySeries,
  buildPartnerMatrix,
  buildReport,
  reportableInvoices,
} from './report.js';

function inv(partial: Partial<InvoiceRow> & Pick<InvoiceRow, 'id'>): InvoiceRow {
  return {
    source_filename: null,
    stored_path: null,
    file_hash: null,
    status: 'done',
    error_message: null,
    invoice_number: `INV-${partial.id}`,
    issuer_name: null,
    issuer_tax_id: null,
    buyer_name: null,
    buyer_tax_id: null,
    issue_date: null,
    fulfillment_date: null,
    due_date: null,
    currency: 'HUF',
    gross_amount: null,
    direction: null,
    partner_name: null,
    partner_tax_id: null,
    extraction_method: 'rules',
    mnb_rate: 1,
    mnb_rate_date: null,
    amount_huf: null,
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
    ...partial,
  };
}

describe('reportableInvoices', () => {
  it('keeps only done with amount_huf', () => {
    const rows = [
      inv({ id: 1, amount_huf: 100, status: 'done' }),
      inv({ id: 2, amount_huf: null, status: 'done' }),
      inv({ id: 3, amount_huf: 50, status: 'error' }),
    ];
    assert.equal(reportableInvoices(rows).length, 1);
  });
});

describe('buildMonthlySeries', () => {
  it('fills empty months with zero between min and max due dates', () => {
    const series = buildMonthlySeries([
      inv({
        id: 1,
        due_date: '2026-01-15',
        direction: 'incoming',
        amount_huf: 1000,
      }),
      inv({
        id: 2,
        due_date: '2026-03-01',
        direction: 'outgoing',
        amount_huf: 500,
      }),
    ]);
    assert.deepEqual(
      series.map((s) => s.month),
      ['2026-01', '2026-02', '2026-03'],
    );
    assert.equal(series[0].incoming, 1000);
    assert.equal(series[0].outgoing, 0);
    assert.equal(series[1].incoming, 0);
    assert.equal(series[1].outgoing, 0);
    assert.equal(series[2].outgoing, 500);
  });

  it('sums multiple invoices in the same month', () => {
    const series = buildMonthlySeries([
      inv({ id: 1, due_date: '2026-05-10', direction: 'incoming', amount_huf: 100 }),
      inv({ id: 2, due_date: '2026-05-20', direction: 'incoming', amount_huf: 50 }),
      inv({ id: 3, due_date: '2026-05-20', direction: 'outgoing', amount_huf: 20 }),
    ]);
    assert.equal(series.length, 1);
    assert.equal(series[0].incoming, 150);
    assert.equal(series[0].outgoing, 20);
  });
});

describe('buildPartnerMatrix', () => {
  it('merges by tax id and puts 0 where direction missing', () => {
    const matrix = buildPartnerMatrix([
      inv({
        id: 1,
        partner_name: 'Alpha Kft',
        partner_tax_id: '11111111-1-11',
        direction: 'incoming',
        amount_huf: 200,
      }),
      inv({
        id: 2,
        partner_name: 'ALPHA KFT.',
        partner_tax_id: '11111111-1-11',
        direction: 'outgoing',
        amount_huf: 80,
      }),
      inv({
        id: 3,
        partner_name: 'Beta GmbH',
        partner_tax_id: 'DE123',
        direction: 'incoming',
        amount_huf: 10,
      }),
    ]);
    assert.equal(matrix.partners.length, 2);
    const alpha = matrix.partners.findIndex((p) => p.tax_id === '11111111-1-11');
    const beta = matrix.partners.findIndex((p) => p.tax_id === 'DE123');
    assert.ok(alpha >= 0 && beta >= 0);
    assert.equal(matrix.partners[alpha].label, 'ALPHA KFT.');
    assert.equal(matrix.partners[beta].label, 'BETA GMBH');
    assert.equal(matrix.incoming[alpha], 200);
    assert.equal(matrix.outgoing[alpha], 80);
    assert.equal(matrix.incoming[beta], 10);
    assert.equal(matrix.outgoing[beta], 0);
  });
});

describe('buildReport', () => {
  it('returns invoices sorted by due date', () => {
    const report = buildReport([
      inv({ id: 2, due_date: '2026-06-01', direction: 'incoming', amount_huf: 1 }),
      inv({ id: 1, due_date: '2026-05-01', direction: 'outgoing', amount_huf: 2 }),
    ]);
    assert.equal(report.invoices[0].id, 1);
    assert.equal(report.invoices[1].id, 2);
    assert.equal(report.months.length, 2);
  });
});
