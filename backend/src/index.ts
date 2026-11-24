import './loadEnv.js';

import cors from 'cors';
import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import db from './db.js';
import { scheduleProcessPending } from './extraction/processInvoice.js';
import './paths.js';
import invoicesRouter from './routes/invoices.js';
import type { HealthResponse } from './types/api.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = Number(process.env.PORT || 8080);

app.use(cors());
app.use(express.json());

app.get('/api/health', (_req, res) => {
  const row = db.prepare('SELECT COUNT(*) AS c FROM invoices').get() as { c: number };
  const body: HealthResponse = {
    ok: true,
    service: 'nordwind',
    invoices: row.c,
    llm: Boolean(process.env.OPENROUTER_API_KEY?.trim()),
  };
  res.json(body);
});

app.use('/api/invoices', invoicesRouter);

const frontendDist = process.env.FRONTEND_DIST
  || path.join(__dirname, '../../frontend/dist');

if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    if (req.path.startsWith('/api/')) return next();
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Nordwind listening on http://0.0.0.0:${PORT}`);
  if (!process.env.OPENROUTER_API_KEY?.trim()) {
    console.warn('OPENROUTER_API_KEY missing — LLM fallback disabled');
  }
  scheduleProcessPending();
});
