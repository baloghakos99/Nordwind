import { isCurrencyCode, isInvoiceDirection } from '../types/domain.js';
import type { ExtractedInvoiceFields, ExtractionValidation } from '../types/invoice.js';
import { isNordwindName, isNordwindTaxId, normalizeTaxId } from './nordwind.js';

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

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DATE_MIN = '2018-01-01';
const DATE_MAX = '2032-12-31';
const AMOUNT_MAX = 50_000_000;

/** Document titles / section headers mistaken for party names. */
const GENERIC_NAME_RE =
  /^(számla|invoice|rechnung|facture|factura|fattura|faktura|szamla)(\s*[/\-|]\s*(számla|invoice|rechnung|facture|factura|fattura|faktura|szamla))?$/i;

/** Street / city lines mistaken for company names. */
const ADDRESS_LIKE_RE =
  /^(infopark|budapest|hungary|magyarország|ungarn|strasse|straße|street|avenue|út|u\.|hrsz)/i;

function isGenericPartyName(name: string | null | undefined): boolean {
  if (!name) return false;
  const n = name.trim().replace(/\s+/g, ' ');
  if (n.length < 3) return true;
  if (GENERIC_NAME_RE.test(n)) return true;
  if (ADDRESS_LIKE_RE.test(n)) return true;
  if (/^\d{4,}/.test(n)) return true; // starts with postal code
  if (!/[A-Za-zÀ-öø-ÿŐőŰű0-9]{2,}/.test(n)) return true;
  return false;
}

/**
 * Invoice numbers like "/" or "—" are extraction noise — fail validation → LLM.
 */
export function isPlausibleInvoiceNumber(raw: string | null | undefined): boolean {
  if (raw == null) return false;
  const s = String(raw).trim();
  if (s.length < 3) return false;
  const alnum = s.replace(/[^A-Za-z0-9]/g, '');
  if (alnum.length < 3) return false;
  return true;
}

/** When present, tax id must look like HU / EU VAT / EIN / digits-with-dashes. */
export function isPlausibleTaxId(raw: string | null | undefined): boolean {
  if (raw == null || raw === '') return true; // absence = warning elsewhere
  const s = String(raw).trim();
  if (/^\d{8}-\d-\d{2}$/.test(s)) return true; // HU domestic
  if (/^[A-Z]{2}[A-Z0-9]{2,12}$/i.test(s.replace(/\s/g, ''))) return true; // EU VAT-ish
  if (/^\d{2}-\d{7}$/.test(s)) return true; // US EIN
  if (/^\d{8,12}$/.test(s.replace(/\s/g, ''))) return true;
  return false;
}

function isIsoDateInRange(raw: string | null | undefined): boolean {
  if (!raw || !ISO_DATE_RE.test(raw)) return false;
  if (raw < DATE_MIN || raw > DATE_MAX) return false;
  const [, m, d] = raw.split('-').map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  return true;
}

function sameParty(
  aName: string | null | undefined,
  aTax: string | null | undefined,
  bName: string | null | undefined,
  bTax: string | null | undefined,
): boolean {
  const ta = normalizeTaxId(aTax);
  const tb = normalizeTaxId(bTax);
  if (ta && tb && ta === tb) return true;
  if (aName && bName && aName.trim().toLowerCase() === bName.trim().toLowerCase()) return true;
  return false;
}

function checkDirectionConsistency(fields: ExtractedInvoiceFields, errors: string[]): void {
  if (!fields.direction || !isInvoiceDirection(fields.direction)) return;

  const issuerUs = isNordwindTaxId(fields.issuer_tax_id) || isNordwindName(fields.issuer_name);
  const buyerUs = isNordwindTaxId(fields.buyer_tax_id) || isNordwindName(fields.buyer_name);

  if (!issuerUs && !buyerUs) {
    errors.push('direction inconsistent: Nordwind not found on issuer or buyer side');
    return;
  }
  if (issuerUs && buyerUs) {
    errors.push('direction inconsistent: Nordwind on both issuer and buyer');
    return;
  }
  if (fields.direction === 'incoming' && !buyerUs) {
    errors.push('direction incoming but buyer is not Nordwind');
  }
  if (fields.direction === 'incoming' && issuerUs) {
    errors.push('direction incoming but issuer is Nordwind');
  }
  if (fields.direction === 'outgoing' && !issuerUs) {
    errors.push('direction outgoing but issuer is not Nordwind');
  }
  if (fields.direction === 'outgoing' && buyerUs) {
    errors.push('direction outgoing but buyer is Nordwind');
  }
}

/**
 * Validate extracted invoice fields. Returns { ok, errors[], warnings[] }.
 * Quality failures are errors so rules → LLM fallback.
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

  if (fields.invoice_number != null && fields.invoice_number !== '') {
    if (!isPlausibleInvoiceNumber(fields.invoice_number)) {
      errors.push(`Implausible invoice_number: ${JSON.stringify(fields.invoice_number)}`);
    }
  }

  if (isGenericPartyName(fields.issuer_name)) {
    errors.push(`issuer_name looks invalid: ${JSON.stringify(fields.issuer_name)}`);
  }
  if (isGenericPartyName(fields.buyer_name)) {
    errors.push(`buyer_name looks invalid: ${JSON.stringify(fields.buyer_name)}`);
  }
  if (isGenericPartyName(fields.partner_name)) {
    errors.push(`partner_name looks invalid: ${JSON.stringify(fields.partner_name)}`);
  }

  if (isNordwindTaxId(fields.partner_tax_id) || isNordwindName(fields.partner_name)) {
    errors.push('partner must not be Nordwind (our company)');
  }

  if (
    sameParty(
      fields.issuer_name,
      fields.issuer_tax_id,
      fields.buyer_name,
      fields.buyer_tax_id,
    )
  ) {
    errors.push('issuer and buyer look like the same party');
  }

  checkDirectionConsistency(fields, errors);

  for (const [label, date] of [
    ['issue_date', fields.issue_date],
    ['fulfillment_date', fields.fulfillment_date],
    ['due_date', fields.due_date],
  ] as const) {
    if (date != null && date !== '' && !isIsoDateInRange(date)) {
      errors.push(`Invalid or out-of-range ${label}: ${JSON.stringify(date)}`);
    }
  }

  if (fields.issue_date && fields.due_date && fields.issue_date > fields.due_date) {
    errors.push('due_date is before issue_date');
  }

  if (
    fields.fulfillment_date
    && fields.issue_date
    && fields.due_date
    && fields.fulfillment_date === fields.due_date
    && fields.fulfillment_date === fields.issue_date
  ) {
    errors.push('issue, fulfillment and due dates are identical');
  }

  if (fields.issuer_tax_id && !isPlausibleTaxId(fields.issuer_tax_id)) {
    errors.push(`Implausible issuer_tax_id: ${JSON.stringify(fields.issuer_tax_id)}`);
  }
  if (fields.buyer_tax_id && !isPlausibleTaxId(fields.buyer_tax_id)) {
    errors.push(`Implausible buyer_tax_id: ${JSON.stringify(fields.buyer_tax_id)}`);
  }
  if (fields.partner_tax_id && !isPlausibleTaxId(fields.partner_tax_id)) {
    errors.push(`Implausible partner_tax_id: ${JSON.stringify(fields.partner_tax_id)}`);
  }

  if (fields.currency && !isCurrencyCode(fields.currency)) {
    errors.push(`Unsupported currency: ${fields.currency}`);
  }

  if (fields.gross_amount != null) {
    if (!(fields.gross_amount > 0)) {
      errors.push('gross_amount must be positive');
    } else if (fields.gross_amount > AMOUNT_MAX) {
      errors.push(`gross_amount unrealistically large: ${fields.gross_amount}`);
    } else if (
      fields.currency
      && fields.currency !== 'HUF'
      && fields.gross_amount < 5
    ) {
      // Catches truncated FX amounts like 2.59 instead of 2597.86
      warnings.push(`gross_amount very small for ${fields.currency}: ${fields.gross_amount}`);
    }
  }

  if (fields.direction && !isInvoiceDirection(fields.direction)) {
    errors.push(`Invalid direction: ${fields.direction}`);
  }

  if (!fields.issuer_tax_id) {
    warnings.push('issuer_tax_id missing');
  }
  if (!fields.buyer_tax_id) {
    warnings.push('buyer_tax_id missing');
  }

  return { ok: errors.length === 0, errors, warnings };
}
