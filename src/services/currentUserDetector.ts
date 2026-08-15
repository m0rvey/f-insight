export interface DetectedCurrentUser {
  playerId?: string;
  nickname?: string;
  faction?: 'faction1' | 'faction2';
  isDetected: boolean;
}

export function detectCurrentPlayer(
  f1Roster: Array<{ player_id?: string; nickname?: string }>,
  f2Roster: Array<{ player_id?: string; nickname?: string }>
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
              const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
              const decoded = typeof atob === 'function' ? atob(base64) : '';
              if (decoded) {
                const payload = JSON.parse(decoded);
                if (payload.nickname) candidateNicknames.push(payload.nickname);
                if (payload.sub) candidateIds.push(payload.sub);
                if (payload.id) candidateIds.push(payload.id);
                if (payload.guid) candidateIds.push(payload.guid);
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
          const match = href.match(/\/(?:[a-z]{2}\/)?players\/([^/?#]+)/i);
          if (match && match[1]) {
            candidateNicknames.push(decodeURIComponent(match[1]));
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
