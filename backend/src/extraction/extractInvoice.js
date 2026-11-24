import { findAmountNear, detectCurrency, parseAmount } from './parseAmount.js';
import { findDateAfter, parseDate } from './parseDate.js';
import { isNordwindName, isNordwindTaxId, normalizeTaxId } from './nordwind.js';

const INVOICE_NO_LABELS =
  /(?:sz[aá]mlasz[aá]m|rechnungsnummer|rechnungsnr\.?|invoice\s*no\.?|invoice\s*number|n[°ºo]\s*de\s*facture|factura\s*n[°º.]?|fattura\s*n[°º.]?|numer\s*faktury)\s*[:.]?\s*/i;

const ISSUE_LABELS =
  /(?:ki[aá]ll[ií]t[aá]s\s*d[aá]tuma|rechnungsdatum|invoice\s*date|date\s*de\s*facture|fecha\s*de\s*factura|data\s*fattura|data\s*wystawienia)\s*[:.]?\s*/i;

const FULFILLMENT_LABELS =
  /(?:teljes[ií]t[eé]s\s*d[aá]tuma|leistungsdatum|date\s*of\s*supply|delivery\s*date|fulfillment\s*date|date\s*de\s*livraison|fecha\s*de\s*entrega|data\s*di\s*consegna|data\s*sprzeda[zż]y)\s*[:.]?\s*/i;

const DUE_LABELS =
  /(?:fizet[eé]si\s*hat[aá]rid[oő]|zahlbar\s*bis|f[aä]lligkeits?datum|due\s*date|date\s*d['’]?[eé]ch[eé]ance|fecha\s*de\s*vencimiento|scadenza|termin\s*p[lł]atno[sś]ci)\s*[:.]?\s*/i;

const GROSS_LABELS =
  /(?:fizetend[oő]\s*[öo]sszesen|rechnungsbetrag|total\s*due|amount\s*due|grand\s*total|brutt[oó]|total\s*ttc|importe\s*total|totale\s*documento|do\s*zap[lł]aty|total\s*(?:amount|gross)?)\s*[:.]?\s*/i;

const CURRENCY_LABELS = /(?:p[eé]nznem|w[aä]hrung|currency|devise|moneda|valuta)\s*[:.]?\s*/i;

// No trailing \b: JS word-boundary breaks on accented letters (e.g. Vevő).
const BUYER_SECTION =
  /(?:vev(?:ő|ö|o)|bill\s*to|rechnungsempf(?:ä|a)nger|client(?:e)?|nabywca|sold\s*to)(?=\s|:|$)/i;

const EU_VAT_RE = /\b([A-Z]{2})\s*([A-Z0-9]{8,12})\b/g;
const HU_TAX_RE = /\b(\d{8}-\d-\d{2})\b/g;
const EIN_RE = /\bEIN\s*(\d{2}-\d{7})\b/i;

function valueAfterLabel(text, labelRe) {
  const m = text.match(labelRe);
  if (!m) return null;
  const rest = text.slice(m.index + m[0].length);
  const line = rest.split('\n')[0].trim();
  if (line) return line.replace(/^[:.\-–]\s*/, '').trim() || null;
  const next = rest.split('\n').slice(1).find((l) => l.trim());
  return next ? next.trim() : null;
}

function extractInvoiceNumber(text) {
  const labeled = valueAfterLabel(text, INVOICE_NO_LABELS);
  if (labeled) {
    const token = labeled.split(/\s{2,}|\s(?=[A-Za-z]{3,})/)[0].trim();
    if (token) return token.replace(/[,\s]+$/, '');
  }
  const invLine = text.match(/\b(INV-[A-Z0-9\-]+|RE-\d{4}-\d+|PI-\d{2}-\d+)\b/i);
  return invLine ? invLine[1] : null;
}

function extractCurrency(text) {
  const labeled = valueAfterLabel(text, CURRENCY_LABELS);
  if (labeled) {
    const code = detectCurrency(labeled) || labeled.trim().toUpperCase().slice(0, 3);
    if (['HUF', 'EUR', 'USD', 'GBP', 'PLN'].includes(code)) return code;
  }
  return detectCurrency(text);
}

function collectTaxIds(text) {
  const found = [];
  for (const m of text.matchAll(HU_TAX_RE)) {
    found.push({ raw: m[1], norm: normalizeTaxId(m[1]), index: m.index });
  }
  for (const m of text.matchAll(EU_VAT_RE)) {
    const raw = `${m[1]}${m[2]}`;
    found.push({ raw, norm: normalizeTaxId(raw), index: m.index });
  }
  const ein = text.match(EIN_RE);
  if (ein) {
    found.push({ raw: ein[1], norm: normalizeTaxId(ein[1]), index: ein.index });
  }
  // Deduplicate by norm, keep first
  const seen = new Set();
  return found.filter((t) => {
    if (seen.has(t.norm)) return false;
    seen.add(t.norm);
    return true;
  });
}

function companyNameNear(text, index, direction = 'before') {
  const lines = text.split('\n');
  let pos = 0;
  let lineIdx = 0;
  for (let i = 0; i < lines.length; i++) {
    const start = pos;
    const end = pos + lines[i].length;
    if (index >= start && index <= end + 1) {
      lineIdx = i;
      break;
    }
    pos = end + 1;
  }

  const skip = /^(adószám|adozam|steuernummer|tax\s*id|vat|ust|k[oö]z[oö]ss|ein|iban|bank|oldal|seite|page|ungarn|hungary|magyarorsz)/i;
  if (direction === 'before') {
    for (let i = lineIdx; i >= Math.max(0, lineIdx - 6); i--) {
      const l = lines[i].trim();
      if (!l || skip.test(l) || /^\d/.test(l)) continue;
      if (/kft|gmbh|inc\.|ltd|llc|s\.r\.o|zrt|nyrt|plc|corp|sarl|s\.a\./i.test(l) || l === l.toUpperCase()) {
        return l;
      }
    }
  }
  return null;
}

function splitParties(text) {
  const buyerMatch = text.match(BUYER_SECTION);
  const buyerStart = buyerMatch ? buyerMatch.index : Math.floor(text.length * 0.35);
  const header = text.slice(0, buyerStart);
  const buyerBlock = text.slice(buyerStart, buyerStart + 500);

  const headerTaxes = collectTaxIds(header);
  const buyerTaxes = collectTaxIds(buyerBlock);
  const allTaxes = collectTaxIds(text);

  let issuerTax = headerTaxes.find((t) => !isNordwindTaxId(t.raw)) || headerTaxes[0] || null;
  let buyerTax = buyerTaxes.find((t) => isNordwindTaxId(t.raw))
    || buyerTaxes[0]
    || allTaxes.find((t) => isNordwindTaxId(t.raw))
    || null;

  // Atlas-style: EIN in header
  if (!issuerTax) {
    const ein = text.match(EIN_RE);
    if (ein) issuerTax = { raw: ein[1], norm: normalizeTaxId(ein[1]), index: ein.index };
  }

  let issuerName = null;
  const firstLines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  for (const l of firstLines.slice(0, 8)) {
    if (/^(számla|rechnung|invoice|factura|fattura|faktura)$/i.test(l)) continue;
    if (INVOICE_NO_LABELS.test(l)) continue;
    if (/kft|gmbh|inc\.|ltd|llc|zrt/i.test(l) || (l.length > 5 && l === l.toUpperCase() && /[A-Z]/.test(l))) {
      if (!isNordwindName(l)) {
        issuerName = l;
        break;
      }
    }
  }
  if (!issuerName && issuerTax) {
    issuerName = companyNameNear(text, issuerTax.index, 'before');
  }

  let buyerName = null;
  const buyerLines = buyerBlock.split('\n').map((l) => l.trim()).filter(Boolean);
  for (const l of buyerLines.slice(0, 10)) {
    if (BUYER_SECTION.test(l)) continue;
    if (/tax|vat|adó|steuer|ust|k[oö]z[oö]ss|ungarn|hungary|magyarorsz|infopark|\d{4}\s/i.test(l)) continue;
    if (/^\d/.test(l) || parseDate(l)) continue;
    if (l.length > 3) {
      buyerName = l;
      break;
    }
  }
  if (!buyerName || !isNordwindName(buyerName)) {
    const nwLine = text.split('\n').map((l) => l.trim()).find((l) => isNordwindName(l));
    if (nwLine && !isNordwindName(issuerName)) buyerName = nwLine;
  }

  return {
    issuerName,
    issuerTaxId: issuerTax?.raw || null,
    buyerName,
    buyerTaxId: buyerTax?.raw || null,
  };
}

function resolveDirection(parties) {
  const issuerIsUs = isNordwindTaxId(parties.issuerTaxId) || isNordwindName(parties.issuerName);
  const buyerIsUs = isNordwindTaxId(parties.buyerTaxId) || isNordwindName(parties.buyerName);

  if (issuerIsUs && !buyerIsUs) {
    return {
      direction: 'outgoing',
      partnerName: parties.buyerName,
      partnerTaxId: parties.buyerTaxId,
    };
  }
  if (buyerIsUs && !issuerIsUs) {
    return {
      direction: 'incoming',
      partnerName: parties.issuerName,
      partnerTaxId: parties.issuerTaxId,
    };
  }
  if (buyerIsUs) {
    return {
      direction: 'incoming',
      partnerName: parties.issuerName,
      partnerTaxId: parties.issuerTaxId,
    };
  }
  if (issuerIsUs) {
    return {
      direction: 'outgoing',
      partnerName: parties.buyerName,
      partnerTaxId: parties.buyerTaxId,
    };
  }
  return {
    direction: null,
    partnerName: parties.issuerName,
    partnerTaxId: parties.issuerTaxId,
  };
}

/**
 * Rule-based invoice field extraction from plain text.
 */
export function extractInvoiceFromText(text) {
  const normalized = text.replace(/\u00a0/g, ' ');

  const invoiceNumber = extractInvoiceNumber(normalized);
  const issueDate = findDateAfter(normalized, ISSUE_LABELS);
  const fulfillmentDate = findDateAfter(normalized, FULFILLMENT_LABELS) || issueDate;
  const dueDate = findDateAfter(normalized, DUE_LABELS);

  const gross = findAmountNear(normalized, GROSS_LABELS);
  let currency = extractCurrency(normalized) || gross?.currency || null;
  let grossAmount = gross?.amount ?? null;

  // Fallback: last "Total due" / money-looking near end
  if (grossAmount == null) {
    const tail = normalized.slice(-400);
    const m = tail.match(/(?:total\s*due|rechnungsbetrag|fizetend[oő])[^\d€$]*([\d.\s,]+\d)/i);
    if (m) grossAmount = parseAmount(m[1]);
  }

  const parties = splitParties(normalized);
  const dir = resolveDirection(parties);

  return {
    invoice_number: invoiceNumber,
    issuer_name: parties.issuerName,
    issuer_tax_id: parties.issuerTaxId,
    buyer_name: parties.buyerName,
    buyer_tax_id: parties.buyerTaxId,
    issue_date: issueDate,
    fulfillment_date: fulfillmentDate,
    due_date: dueDate,
    currency,
    gross_amount: grossAmount,
    direction: dir.direction,
    partner_name: dir.partnerName,
    partner_tax_id: dir.partnerTaxId,
  };
}

export { parseDate, parseAmount };
