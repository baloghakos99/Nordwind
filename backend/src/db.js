import Database from 'better-sqlite3';
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

function migrate(database) {
  const cols = database.prepare('PRAGMA table_info(invoices)').all().map((c) => c.name);
  if (!cols.includes('stored_path')) {
    database.exec('ALTER TABLE invoices ADD COLUMN stored_path TEXT');
  }
}

export default db;
