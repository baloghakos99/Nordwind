import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { getProcessConcurrency, mapPool } from './concurrency.js';

describe('getProcessConcurrency', () => {
  it('defaults to 3', () => {
    assert.equal(getProcessConcurrency({}), 3);
    assert.equal(getProcessConcurrency({ LLM_CONCURRENCY: '' }), 3);
  });

  it('parses and clamps', () => {
    assert.equal(getProcessConcurrency({ LLM_CONCURRENCY: '5' }), 5);
    assert.equal(getProcessConcurrency({ LLM_CONCURRENCY: '0' }), 1);
    assert.equal(getProcessConcurrency({ LLM_CONCURRENCY: '-2' }), 1);
    assert.equal(getProcessConcurrency({ LLM_CONCURRENCY: '99' }), 16);
    assert.equal(getProcessConcurrency({ LLM_CONCURRENCY: '2.9' }), 2);
    assert.equal(getProcessConcurrency({ LLM_CONCURRENCY: 'abc' }), 1);
  });
});

describe('mapPool', () => {
  it('preserves order and respects concurrency', async () => {
    let live = 0;
    let maxLive = 0;
    const out = await mapPool([1, 2, 3, 4, 5], 2, async (n) => {
      live += 1;
      maxLive = Math.max(maxLive, live);
      await new Promise((r) => setTimeout(r, 20));
      live -= 1;
      return n * 10;
    });
    assert.deepEqual(out, [10, 20, 30, 40, 50]);
    assert.ok(maxLive <= 2, `maxLive=${maxLive}`);
    assert.ok(maxLive >= 2, 'expected pool to use both workers');
  });

  it('handles empty list', async () => {
    const out = await mapPool([], 4, async () => 1);
    assert.deepEqual(out, []);
  });
});
