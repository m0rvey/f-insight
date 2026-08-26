import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { detectCurrentPlayer } from '../src/services/currentUserDetector';

describe('currentUserDetector', () => {
  let mockStorage: Record<string, string> = {};

  beforeEach(() => {
    mockStorage = {};
    // The storage object doubles as the data store: entries become own
    // enumerable properties, so Object.keys(storage) sees them exactly like
    // a real browser Storage (plus the API methods, which getItem never
    // returns for since detector only reads stored strings).
    const storageMock: any = mockStorage;
    storageMock.getItem = function (key: string) {
      return Object.prototype.hasOwnProperty.call(this, key) ? (this as any)[key] : null;
    };
    storageMock.setItem = function (key: string, value: string) {
      (this as any)[key] = value;
    };
    storageMock.removeItem = function (key: string) {
      delete (this as any)[key];
    };
    storageMock.clear = function () {
      for (const k of Object.keys(this)) {
        if (!['getItem', 'setItem', 'removeItem', 'clear'].includes(k)) delete (this as any)[k];
      }
    };

    (globalThis as any).window = {
      localStorage: storageMock,
      sessionStorage: storageMock,
    };
  });

  afterEach(() => {
    mockStorage = {};
    delete (globalThis as any).document;
  });

  it('should detect current user from localStorage user object', () => {
    mockStorage['user'] = JSON.stringify({
      id: 'p1_id',
      nickname: 's1mple',
    });

    const f1Roster = [
      { player_id: 'p1_id', nickname: 's1mple' },
      { player_id: 'p2_id', nickname: 'b1t' },
    ];
    const f2Roster = [
      { player_id: 'p3_id', nickname: 'zywoo' },
      { player_id: 'p4_id', nickname: 'apex' },
    ];

    const result = detectCurrentPlayer(f1Roster, f2Roster);
    expect(result.isDetected).toBe(true);
    expect(result.playerId).toBe('p1_id');
    expect(result.nickname).toBe('s1mple');
    expect(result.faction).toBe('faction1');
  });

  it('should detect current user in faction 2 from DOM profile link', () => {
    (globalThis as any).document = {
      querySelectorAll: (sel: string) => {
        if (sel.includes('header')) {
          return [{
            getAttribute: (attr: string) => (attr === 'href' ? '/en/players/zywoo' : null),
          }];
        }
        return [];
      },
    };

    const f1Roster = [
      { player_id: 'p1_id', nickname: 's1mple' },
      { player_id: 'p2_id', nickname: 'b1t' },
    ];
    const f2Roster = [
      { player_id: 'p3_id', nickname: 'zywoo' },
      { player_id: 'p4_id', nickname: 'apex' },
    ];

    const result = detectCurrentPlayer(f1Roster, f2Roster);
    expect(result.isDetected).toBe(true);
    expect(result.playerId).toBe('p3_id');
    expect(result.nickname).toBe('zywoo');
    expect(result.faction).toBe('faction2');
  });

  it('should return isDetected false when no user is logged in', () => {
    const f1Roster = [
      { player_id: 'p1_id', nickname: 's1mple' },
    ];
    const f2Roster = [
      { player_id: 'p2_id', nickname: 'zywoo' },
    ];

    const result = detectCurrentPlayer(f1Roster, f2Roster);
    expect(result.isDetected).toBe(false);
  });

  it('matches an observed identity by guid against the roster', () => {
    // Intercepted user payload: FACEIT navbar fetches the logged-in player
    // right after page load — guid lands in the roster intersection.
    const f1Roster = [
      { player_id: 'p1_id', nickname: 's1mple' },
    ];
    const f2Roster = [
      { player_id: 'guid-aaaa-bbbb', nickname: 'zywoo' },
    ];

    const result = detectCurrentPlayer(f1Roster, f2Roster, [{ id: 'guid-aaaa-bbbb', nickname: 'someone-else' }]);
    expect(result.isDetected).toBe(true);
    expect(result.playerId).toBe('guid-aaaa-bbbb');
    expect(result.faction).toBe('faction2');
  });

  it('treats a UUID navbar link as an id candidate, not a nickname', () => {
    (globalThis as any).document = {
      querySelectorAll: (sel: string) => {
        if (sel.includes('header')) {
          return [{
            getAttribute: (attr: string) =>
              attr === 'href' ? '/players/123e4567-e89b-12d3-a456-426614174000' : null,
          }];
        }
        return [];
      },
    };

    const result = detectCurrentPlayer(
      [{ player_id: 'p1_id', nickname: 's1mple' }],
      [{ player_id: '123e4567-e89b-12d3-a456-426614174000', nickname: 'zywoo' }]
    );
    expect(result.isDetected).toBe(true);
    expect(result.faction).toBe('faction2');
  });

  it('finds the user in a renamed storage key via the generalized sweep', () => {
    // FACEIT renames storage keys between releases; a nested envelope under
    // an unknown key must still yield the identity.
    mockStorage['faceit-web:session:v9'] = JSON.stringify({
      session: 'x',
      user: { guid: 'p2_id', nickname: 'zywoo' },
    });

    const result = detectCurrentPlayer(
      [{ player_id: 'p1_id', nickname: 's1mple' }],
      [{ player_id: 'p2_id', nickname: 'zywoo' }]
    );
    expect(result.isDetected).toBe(true);
    expect(result.faction).toBe('faction2');
  });

  it('rejects ambiguous observed identities spanning both factions', () => {
    // Adversarial: opening opponent profiles produces the same users/v1
    // identity signal as your own navbar fetch. Two distinct roster hits
    // must NOT guess — detection fails honestly instead.
    const result = detectCurrentPlayer(
      [{ player_id: 'p1_id', nickname: 's1mple' }],
      [{ player_id: 'p3_id', nickname: 'zywoo' }],
      [{ id: 'p1_id' }, { id: 'p3_id' }]
    );
    expect(result.isDetected).toBe(false);
  });

  it('skips an ambiguous higher tier but resolves from the next one', () => {
    // Auth-tier pollution: two different roster players cached under known
    // keys make Tier 1 ambiguous. The unambiguous traffic identity still
    // resolves via Tier 3.
    mockStorage['user'] = JSON.stringify({ id: 'p1_id', nickname: 's1mple' });
    mockStorage['auth_user'] = JSON.stringify({ id: 'p3_id', nickname: 'zywoo' });
    delete (globalThis as any).document;

    const result = detectCurrentPlayer(
      [{ player_id: 'p1_id', nickname: 's1mple' }],
      [{ player_id: 'p3_id', nickname: 'zywoo' }],
      [{ id: 'p1_id', nickname: 's1mple' }]
    );
    expect(result.isDetected).toBe(true);
    expect(result.playerId).toBe('p1_id');
    expect(result.faction).toBe('faction1');
  });

  it('rejects an ambiguous storage sweep instead of first-match-wins', () => {
    // Adversarial: previously the flat pool returned the FIRST roster hit,
    // so whichever stale blob came first decided "your" team.
    mockStorage['faceit-web:a'] = JSON.stringify({ user: { guid: 'p1_id', nickname: 's1mple' } });
    mockStorage['faceit-web:b'] = JSON.stringify({ user: { guid: 'p3_id', nickname: 'zywoo' } });
    delete (globalThis as any).document;

    const result = detectCurrentPlayer(
      [{ player_id: 'p1_id', nickname: 's1mple' }],
      [{ player_id: 'p3_id', nickname: 'zywoo' }]
    );
    expect(result.isDetected).toBe(false);
  });

  it('survives malformed percent-encoding in navbar links', () => {
    (globalThis as any).document = {
      querySelectorAll: (sel: string) => {
        if (sel.includes('header')) {
          return [
            { getAttribute: (attr: string) => (attr === 'href' ? '/players/%zz' : null) },
            { getAttribute: (attr: string) => (attr === 'href' ? '/en/players/zywoo' : null) },
          ];
        }
        return [];
      },
    };

    const result = detectCurrentPlayer(
      [{ player_id: 'p1_id', nickname: 's1mple' }],
      [{ player_id: 'p3_id', nickname: 'zywoo' }]
    );
    expect(result.isDetected).toBe(true);
    expect(result.faction).toBe('faction2');
  });
});
