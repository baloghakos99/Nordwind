/** ISO calendar date `YYYY-MM-DD` (fulfillment / due / issue). */
export type IsoDate = string;

/** Currencies supported by the assignment + MNB path. */
export type CurrencyCode = 'HUF' | 'EUR' | 'USD' | 'GBP' | 'PLN';

/**
 * Cash-flow direction relative to Nordwind Solutions Kft.
 * - incoming: we are the buyer
 * - outgoing: we are the issuer
 */
export type InvoiceDirection = 'incoming' | 'outgoing';

export type InvoiceStatus = 'pending' | 'processing' | 'done' | 'error';

export type ExtractionMethod = 'rules' | 'llm';

export const SUPPORTED_CURRENCIES: readonly CurrencyCode[] = [
  'HUF',
  'EUR',
  'USD',
  'GBP',
  'PLN',
] as const;

export function isCurrencyCode(value: string): value is CurrencyCode {
  return (SUPPORTED_CURRENCIES as readonly string[]).includes(value);
}

export function isInvoiceDirection(value: string): value is InvoiceDirection {
  return value === 'incoming' || value === 'outgoing';
}
