import type {
  DirectionResolution,
  ExtractedInvoiceFields,
  Parties,
  TaxIdHit,
} from '../types/invoice.js';
import {
  findAmountNear,
  findLastPositiveAmount,
  detectCurrency,
  parseAmount,
} from './parseAmount.js';
import { findDateAfter, parseDate } from './parseDate.js';
import { isNordwindName, isNordwindTaxId, normalizeTaxId } from './nordwind.js';
import { isGenericPartyName } from './validate.js';

// Same-line only after factura/fattura (no \\n), else "FACTURA\\nNº de…" swallows the label.
const INVOICE_NO_LABEL_TOKEN =
  '(?:sz[aá]mlasz[aá]m|rechnungsnummer|rechnungsnr\\.?|invoice\\s*no\\.?|invoice\\s*number|n[°ºo]\\s*de\\s*factur[ae]|factura[^\\S\\n]*n[°ºo.]|fattura[^\\S\\n]*n[°ºo.]|numer\\s*faktury)';

const INVOICE_NO_LABELS = new RegExp(`${INVOICE_NO_LABEL_TOKEN}\\s*[:.]?\\s*`, 'i');

/** Residual second-language label after the first match (e.g. "/ Invoice No.:"). */
const INVOICE_NO_LABEL_AGAIN = new RegExp(
  `^(?:\\/\\s*)?${INVOICE_NO_LABEL_TOKEN}\\s*[:.]?\\s*`,
  'i',
);

const ISSUE_LABELS =
  /(?:ki[aá]ll[ií]t[aá]s\s*d[aá]tuma|rechnungsdatum|invoice\s*date|date\s*de\s*facture|fecha\s*de\s*(?:factura|emisi[oó]n)|data\s*fattura|data\s*wystawienia)\s*[:.]?\s*/i;

const FULFILLMENT_LABELS =
  /(?:teljes[ií]t[eé]s\s*d[aá]tuma|leistungsdatum|date\s*of\s*supply|delivery\s*date|fulfillment\s*date|date\s*de\s*livraison|date\s*de\s*prestation|fecha\s*de\s*(?:entrega|operaci[oó]n)|data\s*di\s*consegna|data\s*prestazione|data\s*sprzeda[zż]y)\s*[:.]?\s*/i;

const DUE_LABELS =
  /(?:fizet[eé]si\s*hat[aá]rid[oő]|zahlbar\s*bis|f[aä]lligkeits?datum|due\s*date|date\s*d['’]?[eé]ch[eé]ance|fecha\s*de\s*vencimiento|data\s*scadenza|scadenza|termin\s*p[lł]atno[sś]ci)\s*[:.]?\s*/i;

// Avoid bare "Total" (matches Total TVA → 0). Prefer explicit payable labels.
const GROSS_LABELS =
  /(?:fizetend[oő]\s*[öo]sszesen|rechnungsbetrag|total\s*due|amount\s*due|grand\s*total|brutt[oó]|net\s*[àa]\s*payer(?:\s*ttc)?|total\s*ttc|total\s*a\s*pagar|importe\s*total|totale\s*documento|do\s*zap[lł]aty|total\s+(?:amount|gross))\s*[:.]?\s*/i;

const CURRENCY_LABELS = /(?:p[eé]nznem|w[aä]hrung|currency|devise|moneda|valuta)\s*[:.]?\s*/i;

// No trailing \b: JS word-boundary breaks on accented letters (e.g. Vevő).
const BUYER_SECTION =
  /(?:vev(?:ő|ö|o)|bill\s*to|rechnungsempf(?:ä|a)nger|factur[eé]\s*[àa]|cessionario|committente|destinatario|client(?:e)?|nabywca|sold\s*to)(?=\s|:|\/|$)/i;

const EU_VAT_RE = /\b([A-Z]{2})\s*([A-Z0-9]{8,12})\b/g;
const HU_TAX_RE = /\b(\d{8}-\d-\d{2})\b/g;
const EIN_RE = /\bEIN\s*(\d{2}-\d{7})\b/i;

/**
 * HU + foreign legal forms (Bt., KG, s.r.o., …).
 * Keep short tokens (ag/kg/ab) as whole words only.
 */
const COMPANY_FORM_RE =
  /\b(?:kft|bt|kkt|zrt|nyrt|e\.?\s*v\.?|gmbh|ag|kg|ohg|gbr|ug|e\.?\s*k\.?|inc\.?|ltd\.?|llc|plc|corp\.?|co\.?|s\.r\.[lo]\.?|s\.l\.?|sp\.\s*z\s*o\.?o\.?|sarl|s\.a\.?s?\.?|s\.p\.a\.?|spa|bv|nv|ab|oy|as|aps)\b\.?/i;

function valueAfterLabel(text: string, labelRe: RegExp): string | null {
  const m = text.match(labelRe);
  if (!m || m.index == null) return null;
  const rest = text.slice(m.index + m[0].length);
  const line = rest.split('\n')[0].trim();
  if (line) return line.replace(/^[:.\-–]\s*/, '').trim() || null;
  const next = rest.split('\n').slice(1).find((l) => l.trim());
  return next ? next.trim() : null;
}

/** Peel bilingual leftovers: "Számlaszám" match leaves "/ Invoice No.: NWS/…". */
function stripChainedInvoiceLabels(raw: string): string {
  let cur = raw.trim();
  for (let i = 0; i < 4; i++) {
    const next = cur.replace(INVOICE_NO_LABEL_AGAIN, '').replace(/^\/\s*/, '').trim();
    if (next === cur) break;
    cur = next;
  }
  return cur;
}

function extractInvoiceNumber(text: string): string | null {
  const labeled = valueAfterLabel(text, INVOICE_NO_LABELS);
  if (labeled) {
    const cleaned = stripChainedInvoiceLabels(labeled);
    const token = cleaned.split(/\s{2,}|\s(?=[A-Za-zÁÉÍÓÖŐÚÜŰáéíóöőúüű]{3,})/)[0].trim();
    // Reject crumbs like "de" from a bad label match; fall through to pattern fallback
    if (token && /[A-Za-z0-9]/.test(token) && token.replace(/[^A-Za-z0-9]/g, '').length >= 3) {
      return token.replace(/[,\s]+$/, '');
    }
  }
  const invLine = text.match(
    /\b(NWS[\/\-]\d{4}[\/\-]\d+|FAC-\d{4}-\d+|F\d{4}-\d+|INV-[A-Z0-9\-]+|RE-\d{4}-\d+|PI-\d{2}-\d+|KT-\d{4}\/\d+|\d{4}-\d{3,5})\b/i,
  );
  return invLine ? invLine[1] : null;
}

/** When buyer label missing: split near Nordwind / second tax id instead of blind 35%. */
function inferBuyerStart(text: string, labeledIndex: number | undefined): number {
  if (labeledIndex != null) return labeledIndex;
  const taxes = collectTaxIds(text);
  if (taxes.length >= 2) {
    const first = taxes[0];
    const nw = taxes.find((t) => isNordwindTaxId(t.raw));
    if (nw && isNordwindTaxId(first.raw)) {
      // Outgoing: buyer block must start after our tax (else Nordwind lands in buyerTaxes)
      const partner = taxes.find((t) => !isNordwindTaxId(t.raw));
      if (partner) {
        return Math.max(nw.index + String(nw.raw).length, partner.index - 100);
      }
    }
    if (nw && !isNordwindTaxId(first.raw)) {
      // Incoming: Nordwind in buyer area — keep a little company-name context
      return Math.max(0, Math.min(nw.index - 100, taxes[0].index + String(taxes[0].raw).length));
    }
    return Math.max(0, taxes[1].index - 100);
  }
  return Math.floor(text.length * 0.35);
}

function extractCurrency(text: string): string | null {
  const labeled = valueAfterLabel(text, CURRENCY_LABELS);
  if (labeled) {
    const code = detectCurrency(labeled) || labeled.trim().toUpperCase().slice(0, 3);
    if (['HUF', 'EUR', 'USD', 'GBP', 'PLN'].includes(code)) return code;
  }
  return detectCurrency(text);
}

function collectTaxIds(text: string): TaxIdHit[] {
  const found: TaxIdHit[] = [];
  for (const m of text.matchAll(HU_TAX_RE)) {
    if (m.index == null) continue;
    const norm = normalizeTaxId(m[1]);
    if (!norm) continue;
    found.push({ raw: m[1], norm, index: m.index });
  }
  for (const m of text.matchAll(EU_VAT_RE)) {
    if (m.index == null) continue;
    // Reject false positives like GREENFIELD → GR + EENFIELD (no digits)
    if (!/\d/.test(m[2])) continue;
    const raw = `${m[1]}${m[2]}`;
    const norm = normalizeTaxId(raw);
    if (!norm) continue;
    found.push({ raw, norm, index: m.index });
  }
  const ein = text.match(EIN_RE);
  if (ein && ein.index != null) {
    const norm = normalizeTaxId(ein[1]);
    if (norm) found.push({ raw: ein[1], norm, index: ein.index });
  }
  // Deduplicate by norm, keep first
  const seen = new Set<string>();
  return found.filter((t) => {
    if (seen.has(t.norm)) return false;
    seen.add(t.norm);
    return true;
  });
}

function companyNameNear(text: string, index: number, direction: 'before' = 'before'): string | null {
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
      if (!l || skip.test(l) || /^\d/.test(l) || isGenericPartyName(l)) continue;
      if (COMPANY_FORM_RE.test(l) || l === l.toUpperCase()) {
        return l;
      }
    }
  }
  return null;
}

function splitParties(text: string): Parties {
  const buyerMatch = text.match(BUYER_SECTION);
  const buyerStart = inferBuyerStart(text, buyerMatch?.index);
  const header = text.slice(0, buyerStart);
  const buyerBlock = text.slice(buyerStart, buyerStart + 500);

  const headerTaxes = collectTaxIds(header);
  const buyerTaxes = collectTaxIds(buyerBlock);
  const allTaxes = collectTaxIds(text);

  let issuerTax: TaxIdHit | null =
    headerTaxes.find((t) => !isNordwindTaxId(t.raw)) || headerTaxes[0] || null;
  // Prefer Nordwind in buyer block when present (incoming); else first buyer-block tax
  let buyerTax: TaxIdHit | null =
    buyerTaxes.find((t) => isNordwindTaxId(t.raw))
    || buyerTaxes.find((t) => !isNordwindTaxId(t.raw))
    || buyerTaxes[0]
    || null;
  // Incoming: Nordwind tax only appears after buyer section
  if (!buyerTax && issuerTax && !isNordwindTaxId(issuerTax.raw)) {
    buyerTax = allTaxes.find((t) => isNordwindTaxId(t.raw)) || null;
  }

  // Atlas-style: EIN in header
  if (!issuerTax) {
    const ein = text.match(EIN_RE);
    if (ein && ein.index != null) {
      const norm = normalizeTaxId(ein[1]);
      if (norm) issuerTax = { raw: ein[1], norm, index: ein.index };
    }
  }

  let issuerName: string | null = null;
  const firstLines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  for (const l of firstLines.slice(0, 10)) {
    if (isGenericPartyName(l)) continue;
    if (INVOICE_NO_LABELS.test(l)) continue;
    if (BUYER_SECTION.test(l)) break;
    if (
      COMPANY_FORM_RE.test(l)
      || (l.length > 5 && l === l.toUpperCase() && /[A-Z]/.test(l) && !isGenericPartyName(l))
    ) {
      issuerName = l;
      break;
    }
  }
  if (!issuerName && issuerTax) {
    issuerName = companyNameNear(text, issuerTax.index, 'before');
  }
  // Header Nordwind tax + no other company → we are the issuer (outgoing NWS)
  if (!issuerName && issuerTax && isNordwindTaxId(issuerTax.raw)) {
    const nwLine = firstLines.find((l) => isNordwindName(l));
    if (nwLine) issuerName = nwLine;
  }

  let buyerName: string | null = null;
  const buyerLines = buyerBlock.split('\n').map((l) => l.trim()).filter(Boolean);
  for (const l of buyerLines.slice(0, 10)) {
    if (BUYER_SECTION.test(l)) continue;
    if (isGenericPartyName(l)) continue;
    if (/tax|vat|adó|steuer|ust|partita\s*iva|tva\s*intracom|nif-?iva|k[oö]z[oö]ss|ungarn|hungary|magyarorsz|hungr[ií]a|italia|italy|france|hongrie|egyesült|united\s*kingdom|infopark|\d{4}\s|company\s*no|siret|descrizione|d[eé]signation|concepto|imponibile|prezzo|q\.?\s*t[aà]/i.test(l)) continue;
    if (/^\d/.test(l) || parseDate(l)) continue;
    if (l.length > 3) {
      buyerName = l;
      break;
    }
  }
  // Incoming fallback only: missing buyer, and Nordwind is not already the issuer
  if (!buyerName && !isNordwindName(issuerName)) {
    const nwLine = text.split('\n').map((l) => l.trim()).find((l) => isNordwindName(l));
    if (nwLine) buyerName = nwLine;
  }

  return {
    issuerName,
    issuerTaxId: issuerTax?.raw || null,
    buyerName,
    buyerTaxId: buyerTax?.raw || null,
  };
}

function resolveDirection(parties: Parties): DirectionResolution {
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
export function extractInvoiceFromText(text: string): ExtractedInvoiceFields {
  const normalized = text.replace(/\u00a0/g, ' ');

  const invoiceNumber = extractInvoiceNumber(normalized);
  const issueDate = findDateAfter(normalized, ISSUE_LABELS);
  const fulfillmentDate = findDateAfter(normalized, FULFILLMENT_LABELS) || issueDate;
  const dueDate = findDateAfter(normalized, DUE_LABELS);

  const gross = findAmountNear(normalized, GROSS_LABELS);
  let currency: string | null = extractCurrency(normalized) || gross?.currency || null;
  let grossAmount: number | null = gross?.amount ?? null;

  if (grossAmount == null || grossAmount <= 0) {
    const tailHit = findLastPositiveAmount(normalized, 500);
    if (tailHit && tailHit.amount > 0) {
      grossAmount = tailHit.amount;
      currency = currency || tailHit.currency;
    }
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
