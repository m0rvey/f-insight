/**
 * Interception rules for FACEIT API traffic (TS side).
 *
 * The MAIN-world hook (public/network-hook.js) does the first-pass filtering
 * with its own copy of these patterns; this module re-validates everything in
 * the isolated world before it is forwarded to the background worker —
 * defense-in-depth against drift between the two layers.
 */

export const INTERCEPT_PATTERNS: RegExp[] = [
  /^\/api\/match\/v2\/match\/[^/?#]+/,
  /^\/users\/v1\/users\/[a-zA-Z0-9.\-_]+/,
  /^\/stats\/v1\/stats\/users\/[^/?#]+\/games\/cs2/,
  /^\/stats\/v1\/stats\/time\/users\/[^/?#]+\/games\/cs2/,
];

export function isInterceptableApiUrl(rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl, 'https://www.faceit.com');
    if (url.hostname !== 'api.faceit.com') return false;
    const path = url.pathname + url.search;
    return INTERCEPT_PATTERNS.some((re) => re.test(path));
  } catch {
    return false;
  }
}

/** Extracts the match id from an intercepted match-details URL, if any. */
export function extractMatchIdFromInterceptedUrl(url: string): string | null {
  const match = url.match(/\/api\/match\/v2\/match\/([a-zA-Z0-9\-]+)/);
  return match ? match[1] : null;
}
