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
  it('parses DE day-dot + month name', () => {
    assert.equal(parseDate('18. August 2026'), '2026-08-18');
    assert.equal(parseDate('14. August 2026'), '2026-08-14');
    assert.equal(parseDate('17. September 2026'), '2026-09-17');
  });
  it('parses FR month names', () => {
    assert.equal(parseDate('13 novembre 2026'), '2026-11-13');
    assert.equal(parseDate('11 novembre 2026'), '2026-11-11');
    assert.equal(parseDate('28 décembre 2026'), '2026-12-28');
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

/** ES incoming — Nº de factura / emisión / operación / TOTAL A PAGAR */
const ES_FAC = `FACTURA
Nº de factura: FAC-2026-0224
SOLUCIONES IBÉRICAS S.L.
Calle de Alcalá 145, 3º B, 28009 Madrid
NIF-IVA ESB86473921
Cliente
NORDWIND SOLUTIONS KFT.
Infopark sétány 7.
1117 Budapest
Hungría
Nº de identificación fiscal: 26481937-2-43
NIF-IVA: HU26481937
Fecha de emisión
18/08/2026
Fecha de operación
17/08/2026
Moneda
EUR
Fecha de vencimiento
17/10/2026
TOTAL A PAGAR
3.305,10 €`;

/** FR outgoing NWS — Facturé à / Net à payer TTC / prestation */
const FR_NWS = `FACTURE
N° de facture: NWS/2026/0039
NORDWIND SOLUTIONS KFT.
Infopark sétány 7., 1117 Budapest
N° TVA intracom. HU26481937
Facturé à
LUMIÈRE CONSEIL SARL
18 rue de la République
69002 Lyon
France
N° TVA intracom.: FR47829461375
Date de facture
11/09/2026
Date de prestation
05/09/2026
Devise
EUR
Date d'échéance
26/09/2026
Net à payer TTC
11 353,00 €`;

/** FR incoming — month names + Net à payer */
const FR_IN = `Lumière Conseil SARL
18 rue de la République · 69002 Lyon · France
N° TVA intracom.: FR47829461375
F A C T U R E
Facturé à
Nordwind Solutions Kft.
Infopark sétány 7.
1117 Budapest
Hongrie
Identifiant fiscal: 26481937-2-43
N° TVA intracom.: HU26481937
N° de facture: F2026-0158
Date de facture: 13 novembre 2026
Date de prestation: 11 novembre 2026
Date d'échéance: 28 décembre 2026
Devise: EUR
Net à payer TTC: 8 130,00 €`;

/** Italian outgoing NWS — Cessionario / Data prestazione */
const IT_NWS = `FATTURA
Fattura n.: NWS/2026/0045
NORDWIND SOLUTIONS KFT.
Infopark sétány 7., 1117 Budapest
Partita IVA HU26481937
Cessionario / Committente
OFFICINA ROMANO S.R.L.
Via Giuseppe Garibaldi 27
10122 Torino
Italia
Partita IVA: IT09583720018
Data fattura
04/11/2026
Data prestazione
31/10/2026
Valuta
EUR
Data scadenza
04/12/2026
TOTALE DOCUMENTO
13.910,00 €`;

/** AT KG + German month names with day-dot */
const AT_KG = `Hoffmann & Söhne KG
Mariahilfer Straße 112 · 1070 Wien · Österreich
USt-IdNr.: ATU58392716
R E C H N U N G
Rechnungsempfänger
Nordwind Solutions Kft.
Infopark sétány 7.
1117 Budapest
Ungarn
Steuernummer: 26481937-2-43
USt-IdNr.: HU26481937
Rechnungsnummer: 2026-0588
Rechnungsdatum: 18. August 2026
Leistungsdatum: 14. August 2026
Zahlbar bis: 17. September 2026
Währung: EUR
Rechnungsbetrag: 6.902,00 €`;

/** HU Bt. issuer — company form was missing from regex → null issuer_name */
const KT_BT = `Kovács és Társa Könyvelőiroda Bt.
Bajcsy-Zsilinszky út 33. · 1065 Budapest · Magyarország
Adószám: 21847502-1-42 · Közösségi adószám: HU21847502
S Z Á M L A
Vevő
Nordwind Solutions Kft.
Infopark sétány 7.
1117 Budapest
Adószám: 26481937-2-43
Közösségi adószám: HU26481937
Számlaszám: KT-2026/038
Kiállítás dátuma: 2026.08.05.
Teljesítés dátuma: 2026.07.31.
Fizetési határidő: 2026.08.13.
Pénznem: HUF
Fizetendő összesen: 418 592 Ft`;

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

  it('extracts Spanish incoming (emisión / TOTAL A PAGAR)', () => {
    const f = extractInvoiceFromText(ES_FAC);
    assert.equal(f.invoice_number, 'FAC-2026-0224');
    assert.equal(f.direction, 'incoming');
    assert.equal(f.currency, 'EUR');
    assert.equal(f.gross_amount, 3305.1);
    assert.equal(f.issue_date, '2026-08-18');
    assert.equal(f.fulfillment_date, '2026-08-17');
    assert.equal(f.due_date, '2026-10-17');
    assert.match(String(f.issuer_name), /IB[EÉ]RICAS|SOLUCIONES/i);
    assert.match(String(f.buyer_name), /Nordwind/i);
    assert.ok(validateExtraction(f).ok, JSON.stringify(validateExtraction(f)));
  });

  it('extracts French outgoing NWS (Facturé à / Net à payer)', () => {
    const f = extractInvoiceFromText(FR_NWS);
    assert.equal(f.invoice_number, 'NWS/2026/0039');
    assert.equal(f.direction, 'outgoing');
    assert.equal(f.currency, 'EUR');
    assert.equal(f.gross_amount, 11353);
    assert.equal(f.issue_date, '2026-09-11');
    assert.equal(f.fulfillment_date, '2026-09-05');
    assert.equal(f.due_date, '2026-09-26');
    assert.match(String(f.buyer_name), /Lumi[eè]re|CONSEIL/i);
    assert.match(String(f.partner_name), /Lumi[eè]re|CONSEIL/i);
    assert.ok(validateExtraction(f).ok, JSON.stringify(validateExtraction(f)));
  });

  it('extracts French incoming with month names', () => {
    const f = extractInvoiceFromText(FR_IN);
    assert.equal(f.invoice_number, 'F2026-0158');
    assert.equal(f.direction, 'incoming');
    assert.equal(f.currency, 'EUR');
    assert.equal(f.gross_amount, 8130);
    assert.equal(f.issue_date, '2026-11-13');
    assert.equal(f.fulfillment_date, '2026-11-11');
    assert.equal(f.due_date, '2026-12-28');
    assert.match(String(f.issuer_name), /Lumi[eè]re/i);
    assert.match(String(f.buyer_name), /Nordwind/i);
    assert.ok(validateExtraction(f).ok, JSON.stringify(validateExtraction(f)));
  });

  it('extracts Italian outgoing NWS (Cessionario / prestazione)', () => {
    const f = extractInvoiceFromText(IT_NWS);
    assert.equal(f.invoice_number, 'NWS/2026/0045');
    assert.equal(f.direction, 'outgoing');
    assert.equal(f.currency, 'EUR');
    assert.equal(f.gross_amount, 13910);
    assert.equal(f.issue_date, '2026-11-04');
    assert.equal(f.fulfillment_date, '2026-10-31');
    assert.equal(f.due_date, '2026-12-04');
    assert.match(String(f.issuer_name), /Nordwind/i);
    assert.match(String(f.buyer_name), /OFFICINA|ROMANO/i);
    assert.match(String(f.partner_name), /OFFICINA|ROMANO/i);
    assert.ok(f.issuer_tax_id && /26481937/i.test(f.issuer_tax_id));
    assert.ok(f.buyer_tax_id && /^IT/i.test(f.buyer_tax_id));
    assert.ok(validateExtraction(f).ok, JSON.stringify(validateExtraction(f)));
  });

  it('extracts Austrian KG with DE month-name dates', () => {
    const f = extractInvoiceFromText(AT_KG);
    assert.equal(f.invoice_number, '2026-0588');
    assert.equal(f.direction, 'incoming');
    assert.equal(f.currency, 'EUR');
    assert.equal(f.gross_amount, 6902);
    assert.equal(f.issue_date, '2026-08-18');
    assert.equal(f.fulfillment_date, '2026-08-14');
    assert.equal(f.due_date, '2026-09-17');
    assert.match(String(f.issuer_name), /Hoffmann/i);
    assert.match(String(f.partner_name), /Hoffmann/i);
    assert.ok(validateExtraction(f).ok, JSON.stringify(validateExtraction(f)));
  });

  it('extracts HU Bt. issuer (KT) without LLM', () => {
    const f = extractInvoiceFromText(KT_BT);
    assert.equal(f.invoice_number, 'KT-2026/038');
    assert.equal(f.direction, 'incoming');
    assert.equal(f.currency, 'HUF');
    assert.equal(f.gross_amount, 418592);
    assert.match(String(f.issuer_name), /Kovács|Konyvel/i);
    assert.match(String(f.partner_name), /Kovács|Konyvel/i);
    assert.match(String(f.buyer_name), /Nordwind/i);
    assert.ok(validateExtraction(f).ok, JSON.stringify(validateExtraction(f)));
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
