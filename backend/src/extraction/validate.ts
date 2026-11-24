import { isCurrencyCode, isInvoiceDirection } from '../types/domain.js';
import type { ExtractedInvoiceFields, ExtractionValidation } from '../types/invoice.js';

const REQUIRED: (keyof ExtractedInvoiceFields)[] = [
  'invoice_number',
  'issuer_name',
  'buyer_name',
  'issue_date',
  'fulfillment_date',
  'due_date',
  'currency',
  'gross_amount',
  'direction',
  'partner_name',
];

/**
 * Validate extracted invoice fields. Returns { ok, errors[], warnings[] }.
 */
export function validateExtraction(fields: ExtractedInvoiceFields): ExtractionValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const key of REQUIRED) {
    const v = fields[key];
    if (v == null || v === '') {
      errors.push(`Missing field: ${key}`);
    }
  }

  if (fields.currency && !isCurrencyCode(fields.currency)) {
    errors.push(`Unsupported currency: ${fields.currency}`);
  }

  if (fields.gross_amount != null) {
    if (!(fields.gross_amount > 0)) {
      errors.push('gross_amount must be positive');
    }
  }

  if (fields.direction && !isInvoiceDirection(fields.direction)) {
    errors.push(`Invalid direction: ${fields.direction}`);
  }

  if (fields.issue_date && fields.due_date && fields.issue_date > fields.due_date) {
    warnings.push('due_date is before issue_date');
  }

  if (
    fields.fulfillment_date
    && fields.issue_date
    && fields.fulfillment_date === fields.due_date
    && fields.fulfillment_date === fields.issue_date
  ) {
    warnings.push('issue, fulfillment and due dates are identical');
  }

  if (!fields.issuer_tax_id) {
    warnings.push('issuer_tax_id missing');
  }
  if (!fields.buyer_tax_id) {
    warnings.push('buyer_tax_id missing');
  }

  return { ok: errors.length === 0, errors, warnings };
}
