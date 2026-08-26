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

/**
 * Extracts the room/match id from a FACEIT PAGE url (/room/<id>), used to
 * verify the live address bar still points at the match whose data we hold.
 * SPA frameworks repaint the next route BEFORE history.pushState lands, so
 * content-side renderers must re-check this against window.location —
 * otherwise stale payloads get rendered onto unrelated pages (/play, home).
 */
export function extractRoomIdFromPageUrl(url: string): string | null {
  const match = url.match(/\/room\/([a-zA-Z0-9\-]+)/);
  return match && match[1] ? match[1] : null;
}

export type InterceptedProfileKind = 'user' | 'stats' | 'time';

/**
 * Classifies an intercepted player-profile URL. Returns which payload shape
 * the body carries and the playerId it belongs to, or null for non-profile
 * URLs (match details etc.). Player ids on these endpoints are FACEIT GUIDs;
 * nicknames are accepted defensively but validated downstream.
 */
export function classifyInterceptedProfileUrl(
  url: string
): { kind: InterceptedProfileKind; playerId: string } | null {
  const patterns: [RegExp, InterceptedProfileKind][] = [
    [/\/users\/v1\/users\/([^/?#]+)/, 'user'],
    [/\/stats\/v1\/stats\/users\/([^/?#]+)\/games\/cs2/, 'stats'],
    [/\/stats\/v1\/stats\/time\/users\/([^/?#]+)\/games\/cs2/, 'time'],
  ];
  for (const [re, kind] of patterns) {
    const m = url.match(re);
    if (m && m[1]) {
      let playerId: string;
      try {
        playerId = decodeURIComponent(m[1]);
      } catch {
        // Malformed percent-encoding must not crash the whole handler
        playerId = m[1];
      }
      // Allow unicode nicknames (RU etc.) — reject only path separators / query / whitespace
      if (/^[^/?#\s]{1,64}$/.test(playerId) && playerId.trim() === playerId) {
        return { kind, playerId };
      }
    }
  }
  return null;
}
