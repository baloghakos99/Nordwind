import db from '../db.js';
import type { IsoDate } from '../types/domain.js';
import type { ExchangeRateRow, MnbRateRow } from '../types/mnb.js';

const selectExact = db.prepare<[string, string], ExchangeRateRow>(`
  SELECT currency, rate_date, unit, rate
  FROM exchange_rates
  WHERE currency = ? AND rate_date = ?
`);

const selectOnOrBefore = db.prepare<[string, string], ExchangeRateRow>(`
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

export function getExactRate(currency: string, rateDate: IsoDate): ExchangeRateRow | null {
  return selectExact.get(currency.toUpperCase(), rateDate) || null;
}

export function getOnOrBeforeRate(currency: string, rateDate: IsoDate): ExchangeRateRow | null {
  return selectOnOrBefore.get(currency.toUpperCase(), rateDate) || null;
}

export function storeRates(rows: MnbRateRow[]): void {
  const tx = db.transaction((list: MnbRateRow[]) => {
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
