/**
 * Max parallel invoice jobs (rules + LLM + FX). Caps OpenRouter fan-out.
 * Env: LLM_CONCURRENCY (default 3, min 1, max 16).
 */
export function getProcessConcurrency(env: NodeJS.ProcessEnv = process.env): number {
  const raw = env.LLM_CONCURRENCY?.trim();
  if (!raw) return 3;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(Math.floor(n), 16);
}

/**
 * Run async work over items with a fixed worker pool. Order of results matches input.
 */
export async function mapPool<T, R>(
  items: readonly T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const limit = Math.max(1, Math.min(Math.floor(concurrency) || 1, items.length || 1));
  const results = new Array<R>(items.length);
  let next = 0;

  const worker = async () => {
    for (;;) {
      const i = next;
      next += 1;
      if (i >= items.length) return;
      results[i] = await fn(items[i], i);
    }
  };

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}
