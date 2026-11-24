import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const dataDir = process.env.DATA_DIR || path.join(__dirname, '../../data');
export const uploadsDir = path.join(dataDir, 'uploads');

fs.mkdirSync(dataDir, { recursive: true });
fs.mkdirSync(uploadsDir, { recursive: true });
