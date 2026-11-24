import assert from 'node:assert/strict';
import { describe, it, before } from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Isolated DB for cache tests
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nw-mnb-'));
process.env.DATA_DIR = tmpDir;

const { parseMnbExchangeRatesXml } = await import('./soapClient.js');
const { roundHalfUp, convertToHuf } = await import('./convert.js');
const { storeRates, getOnOrBeforeRate } = await import('./rateCache.js');

const SAMPLE_INNER = `
<MNBExchangeRates>
  <Day date="2026-05-29">
    <Rate unit="1" curr="EUR">395,12000</Rate>
    <Rate unit="1" curr="USD">365,67000</Rate>
  </Day>
  <Day date="2026-05-30">
    <Rate unit="1" curr="EUR">396,50000</Rate>
    <Rate unit="1" curr="USD">366,10000</Rate>
  </Day>
</MNBExchangeRates>
`.trim();

describe('parseMnbExchangeRatesXml', () => {
  it('parses comma decimals and currencies', () => {
    const rows = parseMnbExchangeRatesXml(SAMPLE_INNER);
    assert.equal(rows.length, 4);
    const eur = rows.find((r) => r.date === '2026-05-30' && r.currency === 'EUR');
    assert.ok(eur);
    assert.equal(eur.rate, 396.5);
    assert.equal(eur.unit, 1);
  });

  it('parses unit != 1', () => {
    const xml = `<MNBExchangeRates><Day date="2026-01-02"><Rate unit="100" curr="JPY">245,12000</Rate></Day></MNBExchangeRates>`;
    const rows = parseMnbExchangeRatesXml(xml);
    assert.equal(rows[0].unit, 100);
    assert.equal(rows[0].rate, 245.12);
  });

  it('decodes escaped SOAP result XML', () => {
    const escaped = SAMPLE_INNER
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    const rows = parseMnbExchangeRatesXml(escaped);
    assert.ok(rows.length >= 2);
  });
});

describe('roundHalfUp', () => {
  it('rounds 0.5 up', () => {
    assert.equal(roundHalfUp(1.5), 2);
    assert.equal(roundHalfUp(2.5), 3);
    assert.equal(roundHalfUp(1086 * 396.5), Math.floor(1086 * 396.5 + 0.5));
  });
});

describe('convertToHuf', () => {
  before(() => {
    storeRates(parseMnbExchangeRatesXml(SAMPLE_INNER));
  });

  it('HUF skips fetch and uses rate 1', async () => {
    let calls = 0;
    const fx = await convertToHuf({
      currency: 'HUF',
      gross_amount: 99644.4,
      fulfillment_date: '2026-09-05',
      fetchRates: async () => {
        calls += 1;
        return [];
      },
    });
    assert.equal(calls, 0);
    assert.equal(fx.mnb_rate, 1);
    assert.equal(fx.mnb_rate_date, '2026-09-05');
    assert.equal(fx.amount_huf, 99644);
  });

  it('weekend uses on-or-before rate from cache', async () => {
    let calls = 0;
    const fx = await convertToHuf({
      currency: 'EUR',
      gross_amount: 100,
      fulfillment_date: '2026-05-31', // Sunday after Fri 05-30
      fetchRates: async () => {
        calls += 1;
        return [];
      },
    });
    assert.equal(calls, 0); // cache hit via on-or-before
    assert.equal(fx.mnb_rate_date, '2026-05-30');
    assert.equal(fx.mnb_rate, 396.5);
    assert.equal(fx.amount_huf, roundHalfUp(100 * 396.5));
  });

  it('unit != 1 divides correctly', async () => {
    storeRates([{ date: '2026-02-03', currency: 'JPY', unit: 100, rate: 250 }]);
    const fx = await convertToHuf({
      currency: 'JPY',
      gross_amount: 1000,
      fulfillment_date: '2026-02-03',
      fetchRates: async () => [],
    });
    // 1000 * 250 / 100 = 2500
    assert.equal(fx.amount_huf, 2500);
  });

  it('second call does not refetch when cached', async () => {
    let calls = 0;
    const fetchRates = async () => {
      calls += 1;
      return parseMnbExchangeRatesXml(`
        <MNBExchangeRates>
          <Day date="2026-03-10"><Rate unit="1" curr="GBP">480,00000</Rate></Day>
        </MNBExchangeRates>`);
    };
    await convertToHuf({
      currency: 'GBP',
      gross_amount: 10,
      fulfillment_date: '2026-03-10',
      fetchRates,
    });
    await convertToHuf({
      currency: 'GBP',
      gross_amount: 20,
      fulfillment_date: '2026-03-10',
      fetchRates,
    });
    assert.equal(calls, 1);
    assert.ok(getOnOrBeforeRate('GBP', '2026-03-10'));
  });
});
