import type {
  CurrencyCode,
  ExtractionMethod,
  InvoiceDirection,
  InvoiceStatus,
  IsoDate,
} from './domain.js';

/** Fields extracted from a PDF (rules or LLM), before FX. */
export interface ExtractedInvoiceFields {
  invoice_number: string | null;
  issuer_name: string | null;
  issuer_tax_id: string | null;
  buyer_name: string | null;
  buyer_tax_id: string | null;
  issue_date: IsoDate | null;
  fulfillment_date: IsoDate | null;
  due_date: IsoDate | null;
  currency: CurrencyCode | string | null;
  gross_amount: number | null;
  direction: InvoiceDirection | null;
  partner_name: string | null;
  partner_tax_id: string | null;
}

/** Persisted invoice row (SQLite). */
export interface InvoiceRow {
  id: number;
  source_filename: string | null;
  stored_path: string | null;
  file_hash: string | null;
  status: InvoiceStatus;
  error_message: string | null;
  invoice_number: string | null;
  issuer_name: string | null;
  issuer_tax_id: string | null;
  buyer_name: string | null;
  buyer_tax_id: string | null;
  issue_date: IsoDate | null;
  fulfillment_date: IsoDate | null;
  due_date: IsoDate | null;
  currency: string | null;
  gross_amount: number | null;
  direction: InvoiceDirection | null;
  partner_name: string | null;
  partner_tax_id: string | null;
  extraction_method: ExtractionMethod | null;
  mnb_rate: number | null;
  mnb_rate_date: IsoDate | null;
  amount_huf: number | null;
  created_at: string;
  updated_at: string;
}

export interface ExtractionValidation {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

export interface Parties {
  issuerName: string | null;
  issuerTaxId: string | null;
  buyerName: string | null;
  buyerTaxId: string | null;
}

export interface DirectionResolution {
  direction: InvoiceDirection | null;
  partnerName: string | null;
  partnerTaxId: string | null;
}

export interface TaxIdHit {
  raw: string;
  norm: string;
  index: number;
}

export interface ParsedAmountHit {
  amount: number;
  currency: CurrencyCode | string | null;
  raw: string;
}
