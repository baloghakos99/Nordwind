import cors from 'cors';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import db from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = Number(process.env.PORT || 8080);

app.use(cors());
app.use(express.json());

app.get('/api/health', (_req, res) => {
  const invoiceCount = db.prepare('SELECT COUNT(*) AS c FROM invoices').get().c;
  res.json({
    ok: true,
    service: 'nordwind',
    invoices: invoiceCount,
  });
});

const frontendDist = process.env.FRONTEND_DIST
  || path.join(__dirname, '../../frontend/dist');

if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.use((req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    if (req.path.startsWith('/api/')) return next();
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Nordwind listening on http://0.0.0.0:${PORT}`);
});
