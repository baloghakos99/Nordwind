import type { CurrencyCode, IsoDate } from './domain.js';

/** One day/currency rate from MNB SOAP (or cache). */
export interface MnbRateRow {
  date: IsoDate;
  currency: string;
  unit: number;
  rate: number;
}

/** Cached exchange_rates table row. */
export interface ExchangeRateRow {
  currency: string;
  rate_date: IsoDate;
  unit: number;
  rate: number;
}

export interface ConvertToHufInput {
  currency: CurrencyCode | string;
  gross_amount: number;
  fulfillment_date: IsoDate;
  fetchRates?: (opts: {
    startDate: IsoDate;
    endDate: IsoDate;
    currencies: string[];
  }) => Promise<MnbRateRow[]>;
  lookbackDays?: number;
}

/** Per-invoice FX result stored on the invoice row. */
export interface FxConversionResult {
  mnb_rate: number;
  mnb_rate_unit: number;
  mnb_rate_date: IsoDate;
  amount_huf: number;
}
