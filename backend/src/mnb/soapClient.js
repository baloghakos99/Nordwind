const MNB_URL = 'http://www.mnb.hu/arfolyamok.asmx';
const SOAP_ACTION = 'http://www.mnb.hu/webservices/MNBArfolyamServiceSoap/GetExchangeRates';

/**
 * Parse MNB day/rate XML fragment into rows.
 * @returns {{ date: string, currency: string, unit: number, rate: number }[]}
 */
export function parseMnbExchangeRatesXml(innerXml) {
  const xml = decodeXmlEntities(String(innerXml || ''));
  const rows = [];
  const dayRe = /<Day\s+date="([^"]+)"[^>]*>([\s\S]*?)<\/Day>/gi;
  let dayMatch;
  while ((dayMatch = dayRe.exec(xml)) !== null) {
    const date = dayMatch[1];
    const body = dayMatch[2];
    const rateRe = /<Rate\s+([^>]+)>([^<]+)<\/Rate>/gi;
    let rateMatch;
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

function decodeXmlEntities(s) {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function extractResultXml(soapBody) {
  const m = soapBody.match(
    /<GetExchangeRatesResult[^>]*>([\s\S]*?)<\/GetExchangeRatesResult>/i,
  );
  if (!m) {
    throw new Error('MNB SOAP: GetExchangeRatesResult missing');
  }
  return m[1];
}

function buildEnvelope(startDate, endDate, currencyNames) {
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

/**
 * Fetch exchange rates from MNB (HTTP SOAP).
 * @param {{ startDate: string, endDate: string, currencies: string[], fetchImpl?: typeof fetch }} opts
 */
export async function fetchExchangeRates({
  startDate,
  endDate,
  currencies,
  fetchImpl = fetch,
}) {
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
