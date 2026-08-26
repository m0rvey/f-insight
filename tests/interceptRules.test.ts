import { describe, it, expect } from 'vitest';
import {
  INTERCEPT_PATTERNS,
  isInterceptableApiUrl,
  extractMatchIdFromInterceptedUrl,
  classifyInterceptedProfileUrl,
} from '../src/services/interceptRules';

describe('interceptRules', () => {
  it('accepts the match-details endpoint with and without query strings', () => {
    expect(isInterceptableApiUrl('https://api.faceit.com/api/match/v2/match/1-abc123')).toBe(true);
    expect(isInterceptableApiUrl('https://api.faceit.com/api/match/v2/match/1-abc123?foo=bar')).toBe(true);
  });

  it('accepts user and cs2 stats endpoints', () => {
    expect(isInterceptableApiUrl('https://api.faceit.com/users/v1/users/a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d')).toBe(true);
    expect(isInterceptableApiUrl('https://api.faceit.com/api/users/v1/users/someplayer')).toBe(false); // wrong prefix
    expect(isInterceptableApiUrl('https://api.faceit.com/stats/v1/stats/users/p1/games/cs2')).toBe(true);
    expect(isInterceptableApiUrl('https://api.faceit.com/stats/v1/stats/time/users/p1/games/cs2?size=30')).toBe(true);
  });

  it('rejects legacy csgo stats and unrelated endpoints', () => {
    expect(isInterceptableApiUrl('https://api.faceit.com/stats/v1/stats/users/p1/games/csgo')).toBe(false);
    expect(isInterceptableApiUrl('https://api.faceit.com/match/v2/match/1-abc')).toBe(false);
    expect(isInterceptableApiUrl('https://api.faceit.com/search/v1/players?q=x')).toBe(false);
  });

  it('rejects non-api hosts and garbage input', () => {
    expect(isInterceptableApiUrl('https://www.faceit.com/api/match/v2/match/1-abc')).toBe(false);
    expect(isInterceptableApiUrl('https://evil.example.com/api/match/v2/match/1-abc')).toBe(false);
    expect(isInterceptableApiUrl('not a url at all')).toBe(false);
    expect(isInterceptableApiUrl('')).toBe(false);
  });

  it('extracts match ids from intercepted match URLs only', () => {
    expect(extractMatchIdFromInterceptedUrl('https://api.faceit.com/api/match/v2/match/1-a2b3c4')).toBe('1-a2b3c4');
    expect(extractMatchIdFromInterceptedUrl('https://api.faceit.com/api/match/v2/match/1-x?w=1')).toBe('1-x');
    expect(extractMatchIdFromInterceptedUrl('https://api.faceit.com/users/v1/users/p1')).toBeNull();
  });

  it('keeps the TS pattern list in sync with the MAIN-world hook contract', () => {
    // Both layers must cover the same four endpoint families.
    expect(INTERCEPT_PATTERNS).toHaveLength(4);
  });

  describe('classifyInterceptedProfileUrl', () => {
    it('classifies users, lifetime stats and recent-match endpoints', () => {
      expect(
        classifyInterceptedProfileUrl('https://api.faceit.com/users/v1/users/a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d')
      ).toEqual({ kind: 'user', playerId: 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d' });
      expect(
        classifyInterceptedProfileUrl('https://api.faceit.com/stats/v1/stats/users/p1/games/cs2')
      ).toEqual({ kind: 'stats', playerId: 'p1' });
      expect(
        classifyInterceptedProfileUrl('https://api.faceit.com/stats/v1/stats/time/users/p1/games/cs2?size=30')
      ).toEqual({ kind: 'time', playerId: 'p1' });
    });

    it('returns null for match and unrelated URLs', () => {
      expect(classifyInterceptedProfileUrl('https://api.faceit.com/api/match/v2/match/1-abc')).toBeNull();
      expect(classifyInterceptedProfileUrl('https://api.faceit.com/search/v1/players?q=x')).toBeNull();
      // legacy csgo game tag must not be treated as cs2 profile data
      expect(
        classifyInterceptedProfileUrl('https://api.faceit.com/stats/v1/stats/time/users/p1/games/csgo')
      ).toBeNull();
    });

    it('rejects player ids outside the safe charset', () => {
      expect(
        classifyInterceptedProfileUrl('https://api.faceit.com/users/v1/users/bad%20id/extra')
      ).toBeNull();
    });
  });
});
