import fs from 'node:fs';
import path from 'node:path';
import db from '../db.js';
import { uploadsDir } from '../paths.js';
import { extractInvoiceFromText } from './extractInvoice.js';
import { extractInvoiceWithLlm, isLlmConfigured } from './llmExtract.js';
import { extractPdfText } from './pdfText.js';
import { validateExtraction } from './validate.js';

const getById = db.prepare('SELECT * FROM invoices WHERE id = ?');

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
    status = ?,
    error_message = ?,
    updated_at = datetime('now')
  WHERE id = ?
`);

const findBusinessDupe = db.prepare(`
  SELECT id FROM invoices
  WHERE id != ?
    AND issuer_tax_id IS NOT NULL
    AND invoice_number IS NOT NULL
    AND issuer_tax_id = ?
    AND invoice_number = ?
  LIMIT 1
`);

const deleteById = db.prepare('DELETE FROM invoices WHERE id = ?');

const listPending = db.prepare(`
  SELECT id FROM invoices WHERE status IN ('pending', 'processing') ORDER BY id
`);

function resolvePdfPath(row) {
  if (!row.stored_path) return null;
  if (path.isAbsolute(row.stored_path)) return row.stored_path;
  return path.join(uploadsDir, row.stored_path);
}

function persistFields(id, fields, method, status, errorMessage) {
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
    status,
    errorMessage,
    id,
  );
}

function handleDupe(id, fields) {
  if (!fields.issuer_tax_id || !fields.invoice_number) return null;
  const dupe = findBusinessDupe.get(id, fields.issuer_tax_id, fields.invoice_number);
  if (!dupe) return null;
  deleteById.run(id);
  return {
    ok: true,
    duplicate: true,
    duplicateOf: dupe.id,
    invoice: getById.get(dupe.id),
  };
}

/**
 * Extract fields for one invoice row. Rules first; LLM only if validation fails.
 */
export async function processInvoiceById(id) {
  const row = getById.get(id);
  if (!row) return { ok: false, error: 'Not found' };

  // Already successfully extracted — do not call LLM again (token saver)
  if (row.status === 'done' && row.extraction_method) {
    return { ok: true, invoice: row, skipped: true };
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

      persistFields(
        id,
        ruleFields,
        'rules',
        'done',
        ruleValidation.warnings.length ? ruleValidation.warnings.join('; ') : null,
      );
      return {
        ok: true,
        invoice: getById.get(id),
        fields: ruleFields,
        validation: ruleValidation,
        extraction_method: 'rules',
      };
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

    let llmFields;
    let llmModel;
    try {
      const llm = await extractInvoiceWithLlm(text, {
        partial: ruleFields,
        ruleErrors: ruleValidation.errors,
      });
      llmFields = llm.fields;
      llmModel = llm.model;
    } catch (e) {
      persistFields(
        id,
        ruleFields,
        null,
        'error',
        `Rules failed; LLM error: ${e.message}`,
      );
      return { ok: false, invoice: getById.get(id), error: e.message };
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

    persistFields(
      id,
      llmFields,
      'llm',
      'done',
      llmValidation.warnings.length
        ? `LLM ${llmModel}; ${llmValidation.warnings.join('; ')}`
        : `LLM ${llmModel}`,
    );

    return {
      ok: true,
      invoice: getById.get(id),
      fields: llmFields,
      validation: llmValidation,
      extraction_method: 'llm',
    };
  } catch (e) {
    setStatus.run('error', e.message || 'Extraction failed', id);
    return { ok: false, invoice: getById.get(id), error: e.message };
  }
}

let queueRunning = false;

export async function processPendingInvoices() {
  if (queueRunning) return { skipped: true };
  queueRunning = true;
  const results = [];
  try {
    const ids = listPending.all().map((r) => r.id);
    for (const id of ids) {
      results.push(await processInvoiceById(id));
    }
  } finally {
    queueRunning = false;
  }
  return { processed: results.length, results };
}

export function scheduleProcessPending() {
  setImmediate(() => {
    processPendingInvoices().catch((err) => {
      console.error('processPendingInvoices failed', err);
    });
  });
}
