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

export function detectCurrentPlayer(
  f1Roster: Array<{ player_id?: string; nickname?: string }>,
  f2Roster: Array<{ player_id?: string; nickname?: string }>,
  observedIdentities: ObservedIdentity[] = []
): DetectedCurrentUser {
  const allPlayers = [
    ...f1Roster.map((p) => ({ ...p, faction: 'faction1' as const })),
    ...f2Roster.map((p) => ({ ...p, faction: 'faction2' as const })),
  ];

  if (allPlayers.length === 0) {
    return { isDetected: false };
  }

  const candidateNicknames: string[] = [];
  const candidateIds: string[] = [];

  // 0. Identities captured from the page's own traffic (highest fidelity:
  // FACEIT's navbar fetches the logged-in user right after page load).
  for (const identity of observedIdentities) {
    if (identity.nickname && typeof identity.nickname === 'string') candidateNicknames.push(identity.nickname);
    if (identity.id && typeof identity.id === 'string') candidateIds.push(identity.id);
  }

  // 1. Try reading localStorage / sessionStorage keys commonly used by FACEIT frontend
  if (typeof window !== 'undefined') {
    try {
      const keysToCheck = ['user', 'auth_user', 'authUser', 'currentUser', 'profile'];
      for (const k of keysToCheck) {
        let raw: string | null = null;
        try {
          raw = window.localStorage?.getItem(k) || window.sessionStorage?.getItem(k);
        } catch {}
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            if (parsed.nickname && typeof parsed.nickname === 'string') candidateNicknames.push(parsed.nickname);
            if (parsed.id && typeof parsed.id === 'string') candidateIds.push(parsed.id);
            if (parsed.guid && typeof parsed.guid === 'string') candidateIds.push(parsed.guid);
            if (parsed.user_id && typeof parsed.user_id === 'string') candidateIds.push(parsed.user_id);
          } catch {
            // not json
          }
        }
      }

      // Generalized sweep: FACEIT renames storage keys between releases.
      // Walk every key (bounded) and accept ANY stored JSON object that
      // carries both a nickname and an id-like field — the fixed key list
      // above only covers the historical names.
      const collectFromStorage = (storage: Storage | undefined) => {
        if (!storage) return;
        let keys: string[] = [];
        try {
          keys = Object.keys(storage);
        } catch {
          return;
        }
        if (keys.length > 300) keys = keys.slice(0, 300);
        for (const k of keys) {
          // Already covered by the targeted pass above.
          if (keysToCheck.includes(k)) continue;
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
            if (parsed.nickname && typeof parsed.nickname === 'string') candidateNicknames.push(parsed.nickname);
            if (parsed.id && typeof parsed.id === 'string') candidateIds.push(parsed.id);
            if (parsed.guid && typeof parsed.guid === 'string') candidateIds.push(parsed.guid);
            if (parsed.user_id && typeof parsed.user_id === 'string') candidateIds.push(parsed.user_id);
            // Nested { user: {...} } envelopes are common in app state blobs.
            const inner = parsed.user;
            if (inner && typeof inner === 'object' && !Array.isArray(inner)) {
              if (inner.nickname && typeof inner.nickname === 'string') candidateNicknames.push(inner.nickname);
              if (inner.guid && typeof inner.guid === 'string') candidateIds.push(inner.guid);
              if (inner.id && typeof inner.id === 'string') candidateIds.push(inner.id);
            }
          } catch {
            // not json
          }
        }
      };
      try {
        collectFromStorage(window.localStorage);
        collectFromStorage(window.sessionStorage);
      } catch {}

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
                  if (payload.nickname) candidateNicknames.push(payload.nickname);
                  if (payload.sub) candidateIds.push(payload.sub);
                  if (payload.id) candidateIds.push(payload.id);
                  if (payload.guid) candidateIds.push(payload.guid);
                }
              }
            }
          } catch {
            // ignore invalid token
          }
        }
      }
    } catch (err) {
      console.debug('[f-insight:CurrentUser] Error reading storage:', err);
    }
  }

  // 2. Try reading DOM headers / navbar profile links
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
        const links = document.querySelectorAll<HTMLAnchorElement>(sel);
        for (const link of links) {
          const href = link.getAttribute('href') || '';
          const match = href.match(/\/(?:[a-z]{2}\/)?players(?:-modal)?\/([^/?#]+)/i);
          if (match && match[1]) {
            const segment = decodeURIComponent(match[1]);
            // New FACEIT UI links the navbar avatar as /players/{guid}.
            if (UUID_RE.test(segment)) candidateIds.push(segment);
            else candidateNicknames.push(segment);
          }
        }
      }
    } catch (err) {
      console.debug('[f-insight:CurrentUser] Error reading DOM:', err);
    }
  }

  // 3. Normalize candidates
  const cleanNicknames = Array.from(new Set(candidateNicknames.map((n) => n.trim().toLowerCase()))).filter(Boolean);
  const cleanIds = Array.from(new Set(candidateIds.map((id) => id.trim()))).filter(Boolean);

  // 4. Match candidates against match rosters
  for (const player of allPlayers) {
    const pNick = (player.nickname || '').trim().toLowerCase();
    const pId = (player.player_id || '').trim();

    if (pNick && cleanNicknames.includes(pNick)) {
      return {
        playerId: player.player_id,
        nickname: player.nickname,
        faction: player.faction,
        isDetected: true,
      };
    }

    if (pId && cleanIds.includes(pId)) {
      return {
        playerId: player.player_id,
        nickname: player.nickname,
        faction: player.faction,
        isDetected: true,
      };
    }
  }

  return { isDetected: false };
}
