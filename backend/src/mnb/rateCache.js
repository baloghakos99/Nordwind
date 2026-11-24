import db from '../db.js';

const selectExact = db.prepare(`
  SELECT currency, rate_date, unit, rate
  FROM exchange_rates
  WHERE currency = ? AND rate_date = ?
`);

const selectOnOrBefore = db.prepare(`
  SELECT currency, rate_date, unit, rate
  FROM exchange_rates
  WHERE currency = ? AND rate_date <= ?
  ORDER BY rate_date DESC
  LIMIT 1
`);

const upsert = db.prepare(`
  INSERT INTO exchange_rates (currency, rate_date, unit, rate, fetched_at)
  VALUES (?, ?, ?, ?, datetime('now'))
  ON CONFLICT(currency, rate_date) DO UPDATE SET
    unit = excluded.unit,
    rate = excluded.rate,
    fetched_at = datetime('now')
`);

export function getExactRate(currency, rateDate) {
  return selectExact.get(currency.toUpperCase(), rateDate) || null;
}

export function getOnOrBeforeRate(currency, rateDate) {
  return selectOnOrBefore.get(currency.toUpperCase(), rateDate) || null;
}

export function storeRates(rows) {
  const tx = db.transaction((list) => {
    for (const row of list) {
      upsert.run(
        row.currency.toUpperCase(),
        row.date,
        row.unit,
        row.rate,
      );
    }
  });
  tx(rows);
}
