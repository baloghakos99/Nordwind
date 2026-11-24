import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { extractInvoiceFromText } from './extractInvoice.js';
import { parseAmount } from './parseAmount.js';
import { parseDate } from './parseDate.js';
import { validateExtraction } from './validate.js';

describe('parseDate', () => {
  it('parses HU dotted month name', () => {
    assert.equal(parseDate('2026. július 16.'), '2026-07-16');
    assert.equal(parseDate('2026. augusztus 3.'), '2026-08-03');
  });
  it('parses DE numeric', () => {
    assert.equal(parseDate('27.10.2026'), '2026-10-27');
    assert.equal(parseDate('11.12.2026'), '2026-12-11');
  });
  it('parses EN month name', () => {
    assert.equal(parseDate('May 1, 2026'), '2026-05-01');
    assert.equal(parseDate('April 30, 2026'), '2026-04-30');
  });
});

describe('parseAmount', () => {
  it('parses HU thousands with spaces', () => {
    assert.equal(parseAmount('186 639 Ft'), 186639);
  });
  it('parses DE thousands with dot', () => {
    assert.equal(parseAmount('1.086,00 €'), 1086);
  });
  it('parses US decimal', () => {
    assert.equal(parseAmount('$889.09'), 889.09);
  });
  it('parses US thousands with comma', () => {
    assert.equal(parseAmount('$2,597.86'), 2597.86);
  });
});

describe('findAmountNear US total', () => {
  it('does not truncate $2,597.86 to 2.59', async () => {
    const { findAmountNear } = await import('./parseAmount.js');
    const text = 'Total due $2,597.86\nReverse charge';
    const hit = findAmountNear(text, /total\s*due\s*[:.]?\s*/i);
    assert.ok(hit);
    assert.equal(hit.amount, 2597.86);
    assert.equal(hit.currency, 'USD');
  });
});

const HU = `SZÁMLA
Számlaszám: PI-26-0057
PANNON IRODASZER KFT.
Árpád út 41., 9021 Győr
Közösségi adószám HU23918466
Vevő
NORDWIND SOLUTIONS KFT.
Infopark sétány 7.
1117 Budapest
Adószám: 26481937-2-43
Közösségi adószám: HU26481937
Kiállítás dátuma
2026. szeptember 10.
Teljesítés dátuma
2026. szeptember 5.
Pénznem
HUF
Fizetési határidő
2026. szeptember 25.
Fizetendő összesen
99 644 Ft`;

const DE = `RECHNUNG
Rechnungsnummer: RE-2026-10182
BRENNER MASCHINENBAU GMBH
Industriestraße 48, 70565 Stuttgart
USt-IdNr. DE287461935
Rechnungsempfänger
NORDWIND SOLUTIONS KFT.
Steuernummer: 26481937-2-43
USt-IdNr.: HU26481937
Rechnungsdatum
27.10.2026
Leistungsdatum
25.10.2026
Währung
EUR
Zahlbar bis
11.12.2026
Rechnungsbetrag
1.086,00 €`;

const EN = `Atlas Cloud Inc.
500 Howard Street, Suite 300
San Francisco, CA 94105
EIN 84-3920175
INVOICE
INV-US-7782470
Bill to
Nordwind Solutions Kft.
Tax ID: 26481937-2-43
VAT No.: HU26481937
Invoice No.: INV-US-7782470
Invoice date: May 1, 2026
Date of supply: April 30, 2026
Due date: May 16, 2026
Currency: USD
Total due $889.09`;

/** Bilingual Nordwind outgoing (NWS) — previously failed rules → LLM */
const NWS_OUT = `SZÁMLA / INVOICE
Számlaszám / Invoice No.: NWS/2026/0044
NORDWIND SOLUTIONS KFT.
Infopark sétány 7., 1117 Budapest
Közösségi adószám / VAT No. HU26481937
Vevő / Bill to
GREENFIELD ANALYTICS LTD.
22 Brushfield Street
London E1 6AN
Egyesült Királyság
Közösségi adószám / VAT No.: GB284719356
Company No. 11842093
Kiállítás dátuma / Invoice date
2026.10.15.
Teljesítés dátuma / Date of supply
2026.10.14.
Pénznem / Currency
GBP
Fizetési határidő / Due date
2026.10.30.
Fizetendő összesen / Total due
8 743,00 GBP`;

describe('extractInvoiceFromText', () => {
  it('extracts Hungarian incoming invoice', () => {
    const f = extractInvoiceFromText(HU);
    assert.equal(f.invoice_number, 'PI-26-0057');
    assert.equal(f.direction, 'incoming');
    assert.equal(f.currency, 'HUF');
    assert.equal(f.gross_amount, 99644);
    assert.equal(f.issue_date, '2026-09-10');
    assert.equal(f.fulfillment_date, '2026-09-05');
    assert.equal(f.due_date, '2026-09-25');
    assert.ok(f.issuer_name);
    assert.match(f.issuer_name, /PANNON/i);
    assert.ok(validateExtraction(f).ok);
  });

  it('extracts German incoming invoice', () => {
    const f = extractInvoiceFromText(DE);
    assert.equal(f.invoice_number, 'RE-2026-10182');
    assert.equal(f.direction, 'incoming');
    assert.equal(f.currency, 'EUR');
    assert.equal(f.gross_amount, 1086);
    assert.equal(f.issue_date, '2026-10-27');
    assert.equal(f.fulfillment_date, '2026-10-25');
    assert.equal(f.due_date, '2026-12-11');
    assert.ok(validateExtraction(f).ok);
  });

  it('extracts English US incoming invoice', () => {
    const f = extractInvoiceFromText(EN);
    assert.equal(f.invoice_number, 'INV-US-7782470');
    assert.equal(f.direction, 'incoming');
    assert.equal(f.currency, 'USD');
    assert.equal(f.gross_amount, 889.09);
    assert.equal(f.issue_date, '2026-05-01');
    assert.equal(f.fulfillment_date, '2026-04-30');
    assert.equal(f.due_date, '2026-05-16');
    assert.ok(f.issuer_name);
    assert.match(f.issuer_name, /Atlas/i);
    assert.ok(validateExtraction(f).ok);
  });

  it('extracts bilingual Nordwind outgoing (NWS) without LLM', () => {
    const f = extractInvoiceFromText(NWS_OUT);
    assert.equal(f.invoice_number, 'NWS/2026/0044');
    assert.equal(f.direction, 'outgoing');
    assert.equal(f.currency, 'GBP');
    assert.equal(f.gross_amount, 8743);
    assert.equal(f.issue_date, '2026-10-15');
    assert.equal(f.fulfillment_date, '2026-10-14');
    assert.equal(f.due_date, '2026-10-30');
    assert.match(String(f.issuer_name), /Nordwind/i);
    assert.match(String(f.buyer_name), /GREENFIELD/i);
    assert.match(String(f.partner_name), /GREENFIELD/i);
    assert.ok(f.issuer_tax_id && /26481937/i.test(f.issuer_tax_id));
    assert.ok(f.buyer_tax_id && /^GB/i.test(f.buyer_tax_id));
    assert.notEqual(f.buyer_tax_id, 'GREENFIELD');
    assert.ok(validateExtraction(f).ok, JSON.stringify(validateExtraction(f)));
  });
});
