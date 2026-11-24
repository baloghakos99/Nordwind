import type { IsoDate } from '../types/domain.js';
import type { MnbRateRow } from '../types/mnb.js';

const MNB_URL = 'http://www.mnb.hu/arfolyamok.asmx';
const SOAP_ACTION = 'http://www.mnb.hu/webservices/MNBArfolyamServiceSoap/GetExchangeRates';

/**
 * Parse MNB day/rate XML fragment into rows.
 */
export function parseMnbExchangeRatesXml(innerXml: string): MnbRateRow[] {
  const xml = decodeXmlEntities(String(innerXml || ''));
  const rows: MnbRateRow[] = [];
  const dayRe = /<Day\s+date="([^"]+)"[^>]*>([\s\S]*?)<\/Day>/gi;
  let dayMatch: RegExpExecArray | null;
  while ((dayMatch = dayRe.exec(xml)) !== null) {
    const date = dayMatch[1];
    const body = dayMatch[2];
    const rateRe = /<Rate\s+([^>]+)>([^<]+)<\/Rate>/gi;
    let rateMatch: RegExpExecArray | null;
    while ((rateMatch = rateRe.exec(body)) !== null) {
      const attrs = rateMatch[1];
      const unitMatch = attrs.match(/\bunit="([^"]+)"/i);
      const currMatch = attrs.match(/\bcurr="([^"]+)"/i);
      if (!currMatch) continue;
      const unit = Number(String(unitMatch?.[1] || '1').replace(',', '.'));
      const rate = Number(String(rateMatch[2]).trim().replace(/\s/g, '').replace(',', '.'));
      if (!Number.isFinite(unit) || !Number.isFinite(rate)) continue;
      rows.push({
        date,
        currency: currMatch[1].toUpperCase(),
        unit: unit || 1,
        rate,
      });
    }
  }
  return rows;
}

function decodeXmlEntities(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function extractResultXml(soapBody: string): string {
  const m = soapBody.match(
    /<GetExchangeRatesResult[^>]*>([\s\S]*?)<\/GetExchangeRatesResult>/i,
  );
  if (!m) {
    throw new Error('MNB SOAP: GetExchangeRatesResult missing');
  }
  return m[1];
}

function buildEnvelope(startDate: string, endDate: string, currencyNames: string): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:web="http://www.mnb.hu/webservices/">
  <soap:Body>
    <web:GetExchangeRates>
      <web:startDate>${startDate}</web:startDate>
      <web:endDate>${endDate}</web:endDate>
      <web:currencyNames>${currencyNames}</web:currencyNames>
    </web:GetExchangeRates>
  </soap:Body>
</soap:Envelope>`;
}

export interface FetchExchangeRatesOpts {
  startDate: IsoDate;
  endDate: IsoDate;
  currencies: string[];
  fetchImpl?: typeof fetch;
}

/**
 * Fetch exchange rates from MNB (HTTP SOAP).
 */
export async function fetchExchangeRates({
  startDate,
  endDate,
  currencies,
  fetchImpl = fetch,
}: FetchExchangeRatesOpts): Promise<MnbRateRow[]> {
  const currencyNames = currencies.map((c) => c.toUpperCase()).join(',');
  const body = buildEnvelope(startDate, endDate, currencyNames);

  const res = await fetchImpl(MNB_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/xml; charset=utf-8',
      SOAPAction: `"${SOAP_ACTION}"`,
    },
    body,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`MNB SOAP HTTP ${res.status}: ${text.slice(0, 200)}`);
  }

  const soapText = await res.text();
  const inner = extractResultXml(soapText);
  return parseMnbExchangeRatesXml(inner);
}

export { MNB_URL, SOAP_ACTION };
