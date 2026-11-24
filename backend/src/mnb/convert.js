import { fetchExchangeRates } from './soapClient.js';
import { getOnOrBeforeRate, storeRates } from './rateCache.js';

/** Half-up for non-negative numbers (0.5 → up). */
export function roundHalfUp(value) {
  if (!Number.isFinite(value)) return null;
  if (value >= 0) return Math.floor(value + 0.5);
  return Math.ceil(value - 0.5);
}

function addDaysIso(isoDate, deltaDays) {
  const d = new Date(`${isoDate}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + deltaDays);
  return d.toISOString().slice(0, 10);
}

/**
 * Resolve MNB rate for currency on/before fulfillmentDate; convert gross → HUF.
 * @param {{ currency: string, gross_amount: number, fulfillment_date: string, fetchRates?: typeof fetchExchangeRates, lookbackDays?: number }} opts
 */
export async function convertToHuf({
  currency,
  gross_amount,
  fulfillment_date,
  fetchRates = fetchExchangeRates,
  lookbackDays = 14,
}) {
  if (!currency) throw new Error('FX: missing currency');
  if (gross_amount == null || !(Number(gross_amount) >= 0)) {
    throw new Error('FX: invalid gross_amount');
  }
  if (!fulfillment_date || !/^\d{4}-\d{2}-\d{2}$/.test(fulfillment_date)) {
    throw new Error('FX: invalid fulfillment_date');
  }

  const curr = currency.toUpperCase();
  const gross = Number(gross_amount);

  if (curr === 'HUF') {
    return {
      mnb_rate: 1,
      mnb_rate_unit: 1,
      mnb_rate_date: fulfillment_date,
      amount_huf: roundHalfUp(gross),
    };
  }

  let row = getOnOrBeforeRate(curr, fulfillment_date);
  if (!row) {
    const startDate = addDaysIso(fulfillment_date, -lookbackDays);
    const rows = await fetchRates({
      startDate,
      endDate: fulfillment_date,
      currencies: [curr],
    });
    if (rows.length) storeRates(rows);
    row = getOnOrBeforeRate(curr, fulfillment_date);
  }

  if (!row) {
    throw new Error(`FX: no MNB rate for ${curr} on or before ${fulfillment_date}`);
  }

  const unit = row.unit || 1;
  const huf = (gross * row.rate) / unit;

  return {
    mnb_rate: row.rate,
    mnb_rate_unit: unit,
    mnb_rate_date: row.rate_date,
    amount_huf: roundHalfUp(huf),
  };
}
