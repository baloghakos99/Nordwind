import { Router } from 'express';
import db from '../db.js';
import { buildReport } from '../aggregation/report.js';
import type { InvoiceRow } from '../types/invoice.js';

const router = Router();

const invoiceColumns = `
  id, source_filename, stored_path, file_hash, status, error_message,
  invoice_number, issuer_name, issuer_tax_id, buyer_name, buyer_tax_id,
  issue_date, fulfillment_date, due_date, currency, gross_amount,
  direction, partner_name, partner_tax_id, extraction_method,
  mnb_rate, mnb_rate_date, amount_huf,
  created_at, updated_at
`;

const listInvoices = db.prepare<[], InvoiceRow>(`
  SELECT ${invoiceColumns} FROM invoices ORDER BY id ASC
`);

router.get('/', (_req, res) => {
  const report = buildReport(listInvoices.all());
  res.json({ ok: true, ...report });
});

export default router;
