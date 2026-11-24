-- Phase 1 skeleton; columns refined in later phases.

CREATE TABLE IF NOT EXISTS invoices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_number TEXT,
  issuer_name TEXT,
  issuer_tax_id TEXT,
  buyer_name TEXT,
  buyer_tax_id TEXT,
  issue_date TEXT,
  fulfillment_date TEXT,
  due_date TEXT,
  currency TEXT,
  gross_amount REAL,
  direction TEXT CHECK (direction IN ('incoming', 'outgoing') OR direction IS NULL),
  partner_name TEXT,
  partner_tax_id TEXT,
  mnb_rate REAL,
  mnb_rate_date TEXT,
  amount_huf INTEGER,
  source_filename TEXT,
  file_hash TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'done', 'error')),
  error_message TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (issuer_tax_id, invoice_number)
);

CREATE TABLE IF NOT EXISTS exchange_rates (
  currency TEXT NOT NULL,
  rate_date TEXT NOT NULL,
  unit REAL NOT NULL DEFAULT 1,
  rate REAL NOT NULL,
  fetched_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (currency, rate_date)
);

CREATE TABLE IF NOT EXISTS upload_errors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  filename TEXT NOT NULL,
  error_message TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
