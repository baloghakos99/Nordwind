import type { InvoiceRow } from './invoice.js';

export interface UploadSummary {
  accepted: number;
  duplicates: number;
  failed: number;
  total: number;
}

export interface UploadResultOk {
  filename: string;
  ok: true;
  duplicate: boolean;
  invoice: InvoiceRow;
}

export interface UploadResultFail {
  filename: string;
  ok: false;
  duplicate: false;
  error: string;
}

export type UploadResultItem = UploadResultOk | UploadResultFail;

export interface UploadResponse {
  ok: boolean;
  summary: UploadSummary;
  results: UploadResultItem[];
  error?: string;
}

export interface InvoiceStatsDto {
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
  invoices: InvoiceRow[];
  stats?: InvoiceStatsDto;
}

export interface HealthResponse {
  ok: true;
  service: 'nordwind';
  invoices: number;
  llm: boolean;
  llm_concurrency: number;
}

export interface ProcessResult {
  ok: boolean;
  skipped?: boolean;
  duplicate?: boolean;
  duplicateOf?: number;
  invoice?: InvoiceRow | null;
  fields?: unknown;
  extraction_method?: string | null;
  fx?: unknown;
  error?: string;
  validation?: unknown;
}

export interface MonthlyPointDto {
  month: string;
  incoming: number;
  outgoing: number;
}

export interface PartnerColumnDto {
  key: string;
  label: string;
  tax_id: string | null;
}

export interface PartnerMatrixDto {
  partners: PartnerColumnDto[];
  incoming: number[];
  outgoing: number[];
}

export interface ReportResponse {
  ok: true;
  months: MonthlyPointDto[];
  partners: PartnerMatrixDto;
  invoices: InvoiceRow[];
}
