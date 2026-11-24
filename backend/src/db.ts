import Database from 'better-sqlite3';
import type { Database as DatabaseType } from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { dataDir } from './paths.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const dbPath = path.join(dataDir, 'nordwind.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
db.exec(schema);

migrate(db);

function migrate(database: DatabaseType): void {
  const cols = database
    .prepare('PRAGMA table_info(invoices)')
    .all()
    .map((c) => (c as { name: string }).name);
  if (!cols.includes('stored_path')) {
    database.exec('ALTER TABLE invoices ADD COLUMN stored_path TEXT');
  }
  if (!cols.includes('extraction_method')) {
    database.exec('ALTER TABLE invoices ADD COLUMN extraction_method TEXT');
  }
  // Backfill: successful extractions before LLM branch were rules-only
  database.exec(`
    UPDATE invoices
    SET extraction_method = 'rules'
    WHERE status = 'done' AND extraction_method IS NULL
  `);
}

export default db;
