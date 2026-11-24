/** Mirrors backend InvoiceRow / API JSON (snake_case). */

export type InvoiceDirection = 'incoming' | 'outgoing';
export type InvoiceStatus = 'pending' | 'processing' | 'done' | 'error';
export type ExtractionMethod = 'rules' | 'llm';

export interface Invoice {
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
  issue_date: string | null;
  fulfillment_date: string | null;
  due_date: string | null;
  currency: string | null;
  gross_amount: number | null;
  direction: InvoiceDirection | null;
  partner_name: string | null;
  partner_tax_id: string | null;
  extraction_method: ExtractionMethod | null;
  mnb_rate: number | null;
  mnb_rate_date: string | null;
  amount_huf: number | null;
  created_at: string;
  updated_at: string;
}

export interface UploadSummary {
  accepted: number;
  duplicates: number;
  failed: number;
  total: number;
}

export interface UploadResponse {
  ok: boolean;
  summary?: UploadSummary;
  results?: unknown[];
  error?: string;
}

export interface InvoiceStats {
  total: number;
  pending: number;
  processing: number;
  done: number;
  error: number;
  done_rules: number;
  done_llm: number;
  busy: number;
  progress: number;
}

export interface InvoiceListResponse {
  invoices: Invoice[];
  stats?: InvoiceStats;
}

export interface MonthlyPoint {
  month: string;
  incoming: number;
  outgoing: number;
}

export interface PartnerColumn {
  key: string;
  label: string;
  tax_id: string | null;
}

export interface PartnerMatrix {
  partners: PartnerColumn[];
  incoming: number[];
  outgoing: number[];
}

export interface ReportResponse {
  ok: true;
  months: MonthlyPoint[];
  partners: PartnerMatrix;
  invoices: Invoice[];
}
