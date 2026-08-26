export interface DetectedCurrentUser {
  playerId?: string;
  nickname?: string;
  faction?: 'faction1' | 'faction2';
  isDetected: boolean;
}

/** Identity seen in intercepted FACEIT user payloads (guid + nickname). */
export interface ObservedIdentity {
  id?: string;
  nickname?: string;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Candidate signals grouped by TRUST TIER. Every source can be polluted:
 * storage caches other players you have viewed, the page's own traffic
 * carries users/v1 payloads for every profile you open, and DOM selectors
 * may catch non-nav links. A flat "first roster hit wins" pool therefore
 * misattributes your team. Instead each tier must resolve to EXACTLY ONE
 * distinct roster player on its own; an ambiguous tier is skipped, and
 * lower tiers are consulted afterwards.
 */
interface CandidatePool {
  nicknames: string[];
  ids: string[];
}

const emptyPool = (): CandidatePool => ({ nicknames: [], ids: [] });

type RosterPlayer = { player_id?: string; nickname?: string; faction: 'faction1' | 'faction2' };

function normalizePool(pool: CandidatePool): CandidatePool {
  return {
    nicknames: Array.from(new Set(pool.nicknames.map((n) => n.trim().toLowerCase()))).filter(Boolean),
    ids: Array.from(new Set(pool.ids.map((id) => id.trim()))).filter(Boolean),
  };
}

/** Distinct roster players matched by a candidate pool (by id or nickname). */
function matchRosterPlayers(pool: CandidatePool, allPlayers: RosterPlayer[]): RosterPlayer[] {
  const unique = new Map<string, RosterPlayer>();
  for (const player of allPlayers) {
    const pNick = (player.nickname || '').trim().toLowerCase();
    const pId = (player.player_id || '').trim();
    const hit =
      (pNick !== '' && pool.nicknames.includes(pNick)) ||
      (pId !== '' && pool.ids.includes(pId));
    if (hit) {
      const key = pId || pNick;
      if (!unique.has(key)) unique.set(key, player);
    }
  }
  return Array.from(unique.values());
}

export function detectCurrentPlayer(
  f1Roster: Array<{ player_id?: string; nickname?: string }>,
  f2Roster: Array<{ player_id?: string; nickname?: string }>,
  observedIdentities: ObservedIdentity[] = []
): DetectedCurrentUser {
  const allPlayers: RosterPlayer[] = [
    ...f1Roster.map((p) => ({ ...p, faction: 'faction1' as const })),
    ...f2Roster.map((p) => ({ ...p, faction: 'faction2' as const })),
  ];

  if (allPlayers.length === 0) {
    return { isDetected: false };
  }

  // ---- Tier 1: authenticated storage (known auth keys + JWT) --------------
  // Highest trust: these keys hold the LOGGED-IN session user.
  const authPool = emptyPool();
  if (typeof window !== 'undefined') {
    try {
      const keysToCheck = ['user', 'auth_user', 'authUser', 'currentUser', 'profile'];
      for (const k of keysToCheck) {
        let raw: string | null = null;
        try {
          raw = window.localStorage?.getItem(k) || window.sessionStorage?.getItem(k);
        } catch {}
        if (raw && typeof raw === 'string') {
          try {
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
              if (parsed.nickname && typeof parsed.nickname === 'string') authPool.nicknames.push(parsed.nickname);
              if (parsed.id && typeof parsed.id === 'string') authPool.ids.push(parsed.id);
              if (parsed.guid && typeof parsed.guid === 'string') authPool.ids.push(parsed.guid);
              if (parsed.user_id && typeof parsed.user_id === 'string') authPool.ids.push(parsed.user_id);
            }
          } catch {
            // not json
          }
        }
      }

      // Check token / JWT payloads in localStorage
      const tokenKeys = ['token', 'jwt', 'auth_token', 'faceit_token', 'id_token'];
      for (const tk of tokenKeys) {
        let token: string | null = null;
        try {
          token = window.localStorage?.getItem(tk);
        } catch {}
        if (token && token.includes('.')) {
          try {
            const parts = token.split('.');
            if (parts.length === 3) {
              // JWT segments use base64url WITHOUT padding — atob throws
              // InvalidCharacterError unless the length is a multiple of 4,
              // so pad manually. Decode via bytes + TextDecoder to keep
              // non-ASCII nicknames intact (atob alone returns Latin-1).
              let base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
              while (base64.length % 4 !== 0) base64 += '=';
              if (typeof atob === 'function') {
                const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
                const decoded = new TextDecoder().decode(bytes);
                if (decoded) {
                  const payload = JSON.parse(decoded);
                  if (payload.nickname) authPool.nicknames.push(payload.nickname);
                  if (payload.sub) authPool.ids.push(payload.sub);
                  if (payload.id) authPool.ids.push(payload.id);
                  if (payload.guid) authPool.ids.push(payload.guid);
                }
              }
            }
          } catch {
            // ignore invalid token
          }
        }
      }
    } catch (err) {
      console.debug('[f-insight:CurrentUser] Error reading auth storage:', err);
    }
  }

  // ---- Tier 2: DOM navbar -------------------------------------------------
  // The site header/nav renders YOUR avatar and profile link.
  const domPool = emptyPool();
  if (typeof document !== 'undefined') {
    try {
      const selectors = [
        'header a[href*="/players/"]',
        'nav a[href*="/players/"]',
        '[data-testid*="user-nav"] a[href*="/players/"]',
        '[data-testid*="user-avatar"] a[href*="/players/"]',
        '[data-testid*="navbar"] a[href*="/players/"]',
        'a[href*="/en/players/"]',
        'a[href*="/ru/players/"]',
        '[class*="UserNavigation"] a[href*="/players/"]',
        '[class*="ProfileLink"]',
      ];

      for (const sel of selectors) {
        let links: HTMLAnchorElement[] = [];
        try {
          links = Array.from(document.querySelectorAll<HTMLAnchorElement>(sel));
        } catch {
          continue;
        }
        for (const link of links) {
          const href = link.getAttribute('href') || '';
          const match = href.match(/\/(?:[a-z]{2}\/)?players(?:-modal)?\/([^/?#]+)/i);
          if (match && match[1]) {
            // Malformed percent-encoding must not abort the remaining links.
            let segment: string;
            try {
              segment = decodeURIComponent(match[1]);
            } catch {
              continue;
            }
            // New FACEIT UI links the navbar avatar as /players/{guid}.
            if (UUID_RE.test(segment)) domPool.ids.push(segment);
            else domPool.nicknames.push(segment);
          }
        }
      }
    } catch (err) {
      console.debug('[f-insight:CurrentUser] Error reading DOM:', err);
    }
  }

  // ---- Tier 3: identities observed in live page traffic -------------------
  // users/v1 payloads fetched by the SPA itself. Ambiguity matters here:
  // opening ANOTHER player's profile produces the same signal shape, so a
  // traffic tier is trusted ONLY when exactly one roster member appears.
  const trafficPool = emptyPool();
  for (const identity of observedIdentities) {
    if (identity.nickname && typeof identity.nickname === 'string') trafficPool.nicknames.push(identity.nickname);
    if (identity.id && typeof identity.id === 'string') trafficPool.ids.push(identity.id);
  }

  // ---- Tier 4: generalized storage sweep ----------------------------------
  // FACEIT renames storage keys between releases, so walk every key
  // (bounded) and accept ANY stored JSON object carrying a nickname plus an
  // id-like field, including nested {user:{...}} envelopes. Persisted blobs
  // may be stale or belong to previously viewed players — trusted LAST and
  // only when unambiguous.
  const sweepPool = emptyPool();
  if (typeof window !== 'undefined') {
    const collectFromStorage = (storage: Storage | undefined, knownKeys: string[]) => {
      if (!storage) return;
      let keys: string[] = [];
      try {
        keys = Object.keys(storage);
      } catch {
        return;
      }
      if (keys.length > 300) keys = keys.slice(0, 300);
      for (const k of keys) {
        // Already covered by the targeted auth pass above.
        if (knownKeys.includes(k)) continue;
        let raw: string | null = null;
        try {
          raw = storage.getItem(k);
        } catch {
          continue;
        }
        if (!raw || typeof raw !== 'string' || raw.length > 100_000 || !raw.includes('nickname')) continue;
        try {
          const parsed = JSON.parse(raw);
          if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) continue;
          if (parsed.nickname && typeof parsed.nickname === 'string') sweepPool.nicknames.push(parsed.nickname);
          if (parsed.id && typeof parsed.id === 'string') sweepPool.ids.push(parsed.id);
          if (parsed.guid && typeof parsed.guid === 'string') sweepPool.ids.push(parsed.guid);
          if (parsed.user_id && typeof parsed.user_id === 'string') sweepPool.ids.push(parsed.user_id);
          // Nested { user: {...} } envelopes are common in app state blobs.
          const inner = parsed.user;
          if (inner && typeof inner === 'object' && !Array.isArray(inner)) {
            if (inner.nickname && typeof inner.nickname === 'string') sweepPool.nicknames.push(inner.nickname);
            if (inner.guid && typeof inner.guid === 'string') sweepPool.ids.push(inner.guid);
            if (inner.id && typeof inner.id === 'string') sweepPool.ids.push(inner.id);
          }
        } catch {
          // not json
        }
      }
    };
    try {
      collectFromStorage(window.localStorage, ['token', 'jwt', 'auth_token', 'faceit_token', 'id_token']);
      collectFromStorage(window.sessionStorage, []);
    } catch {}
  }

  // ---- Resolve: first tier matching EXACTLY ONE distinct player wins ------
  const tiers: Array<[string, CandidatePool]> = [
    ['auth-storage', authPool],
    ['dom-navbar', domPool],
    ['observed-traffic', trafficPool],
    ['storage-sweep', sweepPool],
  ];

  for (const [tier, rawPool] of tiers) {
    const pool = normalizePool(rawPool);
    const matched = matchRosterPlayers(pool, allPlayers);
    if (matched.length === 1) {
      const player = matched[0];
      return {
        playerId: player.player_id,
        nickname: player.nickname,
        faction: player.faction,
        isDetected: true,
      };
    }
    if (matched.length > 1) {
      console.debug(
        `[f-insight:CurrentUser] ${tier} candidates match ${matched.length} roster players — ambiguous, skipping tier`
      );
    }
  }

  return { isDetected: false };
}
