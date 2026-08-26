import { LOBBY_CONFIG } from '../constants/config';

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Runs async work over a list with a limited number of concurrent workers.
 * A small delay after each item smooths the request burst so we never trip
 * Cloudflare rate-limits on api.faceit.com.
 * Extracted from BackgroundMessageHandler to keep that file focused on orchestration.
 */
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
  delayMs: number = LOBBY_CONFIG.MAP_WITH_CONCURRENCY_DEFAULT_DELAY_MS
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;

  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
      if (delayMs > 0) await sleep(delayMs);
    }
  };

  const workers = Array.from({ length: Math.min(limit, items.length) }, worker);
  await Promise.all(workers);
  return results;
}

export { sleep };
