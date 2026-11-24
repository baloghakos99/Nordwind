import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { Router } from 'express';
import multer from 'multer';
import db from '../db.js';
import { uploadsDir } from '../paths.js';

const router = Router();

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const safe = `${Date.now()}-${Math.random().toString(36).slice(2)}.upload`;
    cb(null, safe);
  },
});

const upload = multer({
  storage,
  limits: {
    files: 120,
    fileSize: 25 * 1024 * 1024,
  },
});

function looksLikePdfName(name) {
  return (name || '').toLowerCase().endsWith('.pdf');
}

function sha256File(filePath) {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

function isPdfMagic(filePath) {
  const fd = fs.openSync(filePath, 'r');
  try {
    const buf = Buffer.alloc(5);
    fs.readSync(fd, buf, 0, 5, 0);
    return buf.toString('utf8') === '%PDF-';
  } finally {
    fs.closeSync(fd);
  }
}

const selectInvoice = db.prepare(`
  SELECT id, source_filename, stored_path, file_hash, status, error_message,
         invoice_number, issuer_name, currency, gross_amount, direction,
         created_at, updated_at
  FROM invoices
  WHERE id = ?
`);

const selectByHash = db.prepare(`
  SELECT id, source_filename, stored_path, file_hash, status, error_message,
         invoice_number, issuer_name, currency, gross_amount, direction,
         created_at, updated_at
  FROM invoices
  WHERE file_hash = ?
`);

const insertPending = db.prepare(`
  INSERT INTO invoices (source_filename, stored_path, file_hash, status, updated_at)
  VALUES (?, ?, ?, 'pending', datetime('now'))
`);

const insertUploadError = db.prepare(`
  INSERT INTO upload_errors (filename, error_message) VALUES (?, ?)
`);

const listInvoices = db.prepare(`
  SELECT id, source_filename, stored_path, file_hash, status, error_message,
         invoice_number, issuer_name, currency, gross_amount, direction,
         created_at, updated_at
  FROM invoices
  ORDER BY id DESC
`);

router.get('/', (_req, res) => {
  res.json({ invoices: listInvoices.all() });
});

router.post('/upload', (req, res) => {
  upload.array('files', 120)(req, res, async (err) => {
    if (err) {
      const message = err.message || 'Upload failed';
      return res.status(400).json({ ok: false, error: message, results: [] });
    }

    const files = req.files || [];
    if (files.length === 0) {
      return res.status(400).json({ ok: false, error: 'No files uploaded', results: [] });
    }

    const results = [];

    for (const file of files) {
      const original = file.originalname || 'unknown.pdf';
      const tempPath = file.path;

      try {
        if (!looksLikePdfName(original) || !isPdfMagic(tempPath)) {
          fs.unlinkSync(tempPath);
          const error = 'File is not a valid PDF';
          insertUploadError.run(original, error);
          results.push({
            filename: original,
            ok: false,
            duplicate: false,
            error,
          });
          continue;
        }

        const hash = await sha256File(tempPath);
        const existing = selectByHash.get(hash);
        if (existing) {
          fs.unlinkSync(tempPath);
          results.push({
            filename: original,
            ok: true,
            duplicate: true,
            invoice: existing,
          });
          continue;
        }

        const finalName = `${hash}.pdf`;
        const finalPath = path.join(uploadsDir, finalName);
        fs.renameSync(tempPath, finalPath);

        const info = insertPending.run(original, finalName, hash);
        const invoice = selectInvoice.get(info.lastInsertRowid);
        results.push({
          filename: original,
          ok: true,
          duplicate: false,
          invoice,
        });
      } catch (e) {
        try {
          if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
        } catch {
          /* ignore cleanup */
        }
        const message = e.message || 'Failed to store file';
        insertUploadError.run(original, message);
        results.push({
          filename: original,
          ok: false,
          duplicate: false,
          error: message,
        });
      }
    }

    const accepted = results.filter((r) => r.ok && !r.duplicate).length;
    const duplicates = results.filter((r) => r.duplicate).length;
    const failed = results.filter((r) => !r.ok).length;

    res.json({
      ok: failed === 0,
      summary: { accepted, duplicates, failed, total: results.length },
      results,
    });
  });
});

export default router;
