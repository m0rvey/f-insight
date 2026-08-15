import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { detectCurrentPlayer } from '../src/services/currentUserDetector';

describe('currentUserDetector', () => {
  let mockStorage: Record<string, string> = {};

  beforeEach(() => {
    mockStorage = {};
    const storageMock = {
      getItem: (key: string) => mockStorage[key] || null,
      setItem: (key: string, value: string) => { mockStorage[key] = value; },
      removeItem: (key: string) => { delete mockStorage[key]; },
      clear: () => { mockStorage = {}; },
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
});
