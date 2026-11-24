import fs from 'node:fs';
import path from 'node:path';
import db from '../db.js';
import { convertToHuf } from '../mnb/convert.js';
import { uploadsDir } from '../paths.js';
import type { ProcessResult } from '../types/api.js';
import type { ExtractionMethod } from '../types/domain.js';
import type { ExtractedInvoiceFields, InvoiceRow } from '../types/invoice.js';
import type { FxConversionResult } from '../types/mnb.js';
import { extractInvoiceFromText } from './extractInvoice.js';
import { extractInvoiceWithLlm, isLlmConfigured } from './llmExtract.js';
import { extractPdfText } from './pdfText.js';
import { validateExtraction } from './validate.js';

const getById = db.prepare<[number], InvoiceRow>('SELECT * FROM invoices WHERE id = ?');

const setStatus = db.prepare(`
  UPDATE invoices
  SET status = ?, error_message = ?, updated_at = datetime('now')
  WHERE id = ?
`);

const updateExtracted = db.prepare(`
  UPDATE invoices SET
    invoice_number = ?,
    issuer_name = ?,
    issuer_tax_id = ?,
    buyer_name = ?,
    buyer_tax_id = ?,
    issue_date = ?,
    fulfillment_date = ?,
    due_date = ?,
    currency = ?,
    gross_amount = ?,
    direction = ?,
    partner_name = ?,
    partner_tax_id = ?,
    extraction_method = ?,
    mnb_rate = ?,
    mnb_rate_date = ?,
    amount_huf = ?,
    status = ?,
    error_message = ?,
    updated_at = datetime('now')
  WHERE id = ?
`);

const updateFxOnly = db.prepare(`
  UPDATE invoices SET
    mnb_rate = ?,
    mnb_rate_date = ?,
    amount_huf = ?,
    status = ?,
    error_message = ?,
    updated_at = datetime('now')
  WHERE id = ?
`);

const findBusinessDupe = db.prepare<[number, string, string], { id: number }>(`
  SELECT id FROM invoices
  WHERE id != ?
    AND issuer_tax_id IS NOT NULL
    AND invoice_number IS NOT NULL
    AND issuer_tax_id = ?
    AND invoice_number = ?
  LIMIT 1
`);

const deleteById = db.prepare('DELETE FROM invoices WHERE id = ?');

const listPending = db.prepare<[], { id: number }>(`
  SELECT id FROM invoices WHERE status IN ('pending', 'processing') ORDER BY id
`);

const listFxBackfill = db.prepare<[], { id: number }>(`
  SELECT id FROM invoices
  WHERE status = 'done' AND amount_huf IS NULL
  ORDER BY id
`);

function resolvePdfPath(row: InvoiceRow): string | null {
  if (!row.stored_path) return null;
  if (path.isAbsolute(row.stored_path)) return row.stored_path;
  return path.join(uploadsDir, row.stored_path);
}

function persistFields(
  id: number,
  fields: ExtractedInvoiceFields,
  method: ExtractionMethod | null,
  status: string,
  errorMessage: string | null,
  fx: FxConversionResult | null = null,
): void {
  updateExtracted.run(
    fields.invoice_number,
    fields.issuer_name,
    fields.issuer_tax_id,
    fields.buyer_name,
    fields.buyer_tax_id,
    fields.issue_date,
    fields.fulfillment_date,
    fields.due_date,
    fields.currency,
    fields.gross_amount,
    fields.direction,
    fields.partner_name,
    fields.partner_tax_id,
    method,
    fx?.mnb_rate ?? null,
    fx?.mnb_rate_date ?? null,
    fx?.amount_huf ?? null,
    status,
    errorMessage,
    id,
  );
}

function handleDupe(id: number, fields: ExtractedInvoiceFields): ProcessResult | null {
  if (!fields.issuer_tax_id || !fields.invoice_number) return null;
  const dupe = findBusinessDupe.get(id, fields.issuer_tax_id, fields.invoice_number);
  if (!dupe) return null;
  deleteById.run(id);
  return {
    ok: true,
    duplicate: true,
    duplicateOf: dupe.id,
    invoice: getById.get(dupe.id) ?? null,
  };
}

async function applyFx(fields: ExtractedInvoiceFields): Promise<FxConversionResult> {
  if (!fields.currency || fields.gross_amount == null || !fields.fulfillment_date) {
    throw new Error('missing currency/amount/fulfillment');
  }
  return convertToHuf({
    currency: fields.currency,
    gross_amount: fields.gross_amount,
    fulfillment_date: fields.fulfillment_date,
  });
}

async function finishWithFx(
  id: number,
  fields: ExtractedInvoiceFields,
  method: ExtractionMethod,
  baseMessage: string | null,
): Promise<ProcessResult> {
  try {
    const fx = await applyFx(fields);
    persistFields(id, fields, method, 'done', baseMessage || null, fx);
    return {
      ok: true,
      invoice: getById.get(id),
      fields,
      extraction_method: method,
      fx,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    persistFields(
      id,
      fields,
      method,
      'error',
      `FX: ${message}`,
      null,
    );
    return {
      ok: false,
      invoice: getById.get(id),
      fields,
      extraction_method: method,
      error: message,
    };
  }
}

/**
 * Convert HUF for an already-extracted done row missing amount_huf.
 */
export async function backfillFxById(id: number): Promise<ProcessResult> {
  const row = getById.get(id);
  if (!row) return { ok: false, error: 'Not found' };
  if (row.amount_huf != null) {
    return { ok: true, invoice: row, skipped: true };
  }
  if (!row.currency || row.gross_amount == null || !row.fulfillment_date) {
    updateFxOnly.run(null, null, null, 'error', 'FX: missing currency/amount/fulfillment', id);
    return { ok: false, invoice: getById.get(id) };
  }

  try {
    const fx = await convertToHuf({
      currency: row.currency,
      gross_amount: row.gross_amount,
      fulfillment_date: row.fulfillment_date,
    });
    updateFxOnly.run(fx.mnb_rate, fx.mnb_rate_date, fx.amount_huf, 'done', row.error_message, id);
    return { ok: true, invoice: getById.get(id), fx };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    updateFxOnly.run(null, null, null, 'error', `FX: ${message}`, id);
    return { ok: false, invoice: getById.get(id), error: message };
  }
}

/**
 * Extract fields for one invoice row. Rules first; LLM only if validation fails.
 * Then MNB FX → amount_huf.
 */
export async function processInvoiceById(id: number): Promise<ProcessResult> {
  const row = getById.get(id);
  if (!row) return { ok: false, error: 'Not found' };

  // Fully done (extracted + FX) — skip re-LLM / re-extract
  if (row.status === 'done' && row.extraction_method && row.amount_huf != null) {
    return { ok: true, invoice: row, skipped: true };
  }

  // Extracted but missing FX — only convert
  if (row.status === 'done' && row.extraction_method && row.amount_huf == null) {
    return backfillFxById(id);
  }

  setStatus.run('processing', null, id);

  const pdfPath = resolvePdfPath(row);
  if (!pdfPath || !fs.existsSync(pdfPath)) {
    setStatus.run('error', 'PDF file missing on disk', id);
    return { ok: false, invoice: getById.get(id) };
  }

  try {
    const text = await extractPdfText(pdfPath);
    if (!text || text.length < 20) {
      setStatus.run('error', 'No extractable text in PDF', id);
      return { ok: false, invoice: getById.get(id) };
    }

    const ruleFields = extractInvoiceFromText(text);
    const ruleValidation = validateExtraction(ruleFields);

    if (ruleValidation.ok) {
      const dupe = handleDupe(id, ruleFields);
      if (dupe) return dupe;

      return finishWithFx(
        id,
        ruleFields,
        'rules',
        ruleValidation.warnings.length ? ruleValidation.warnings.join('; ') : null,
      );
    }

    // --- LLM fallback ---
    if (!isLlmConfigured()) {
      persistFields(
        id,
        ruleFields,
        null,
        'error',
        `Rules failed (${ruleValidation.errors.join('; ')}); OPENROUTER_API_KEY not set for LLM fallback`,
      );
      return {
        ok: false,
        invoice: getById.get(id),
        fields: ruleFields,
        validation: ruleValidation,
      };
    }

    let llmFields: ExtractedInvoiceFields;
    let llmModel: string;
    try {
      const llm = await extractInvoiceWithLlm(text, {
        partial: ruleFields,
        ruleErrors: ruleValidation.errors,
      });
      llmFields = llm.fields;
      llmModel = llm.model;
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      persistFields(
        id,
        ruleFields,
        null,
        'error',
        `Rules failed; LLM error: ${message}`,
      );
      return { ok: false, invoice: getById.get(id), error: message };
    }

    const llmValidation = validateExtraction(llmFields);
    if (!llmValidation.ok) {
      persistFields(
        id,
        llmFields,
        'llm',
        'error',
        `LLM (${llmModel}) invalid: ${llmValidation.errors.join('; ')}`,
      );
      return {
        ok: false,
        invoice: getById.get(id),
        fields: llmFields,
        validation: llmValidation,
        extraction_method: 'llm',
      };
    }

    const dupe = handleDupe(id, llmFields);
    if (dupe) return dupe;

    const msg = llmValidation.warnings.length
      ? `LLM ${llmModel}; ${llmValidation.warnings.join('; ')}`
      : `LLM ${llmModel}`;
    return finishWithFx(id, llmFields, 'llm', msg);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Extraction failed';
    setStatus.run('error', message, id);
    return { ok: false, invoice: getById.get(id), error: message };
  }
}

let queueRunning = false;

export async function processPendingInvoices(): Promise<{
  skipped?: boolean;
  processed?: number;
  results?: ProcessResult[];
}> {
  if (queueRunning) return { skipped: true };
  queueRunning = true;
  const results: ProcessResult[] = [];
  try {
    const ids = [
      ...listPending.all().map((r) => r.id),
      ...listFxBackfill.all().map((r) => r.id),
    ];
    const unique = [...new Set(ids)];
    for (const id of unique) {
      results.push(await processInvoiceById(id));
    }
  } finally {
    queueRunning = false;
  }
  return { processed: results.length, results };
}

export function scheduleProcessPending(): void {
  setImmediate(() => {
    processPendingInvoices().catch((err: unknown) => {
      console.error('processPendingInvoices failed', err);
    });
  });
}
