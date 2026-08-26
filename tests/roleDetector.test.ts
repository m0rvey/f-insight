import { describe, it, expect } from 'vitest';
import { detectPlayerRole } from '../src/services/roleDetector';
import { FaceitPlayerFullStats } from '../src/types/faceit';

function mkStats(overrides: Partial<FaceitPlayerFullStats>): FaceitPlayerFullStats {
  return {
    playerId: 'p1',
    nickname: 'Test',
    avatar: '',
    country: 'se',
    elo: 1500,
    skillLevel: 5,
    totalMatches: 400,
    overallWinRate: 50,
    overallKd: 1.0,
    overallHsPercent: 45,
    overallAdr: 78,
    last30Kd: undefined,
    last30Adr: undefined,
    last30HsPercent: undefined,
    currentStreak: { type: 'NONE', count: 0 },
    recentMatches: [],
    mapStats: {},
    formStatus: 'STABLE',
    recentKd: 1.0,
    recentAdr: 78,
    ...overrides,
  } as FaceitPlayerFullStats;
}

describe('roleDetector', () => {
  it('detects AWP — low HS + high KD', () => {
    const s = mkStats({ overallKd: 1.25, overallHsPercent: 32, overallAdr: 75 });
    expect(detectPlayerRole(s)).toBe('AWP');
  });
  it('detects Entry — high ADR + high KD + high HS', () => {
    const s = mkStats({ overallKd: 1.2, overallHsPercent: 60, overallAdr: 88 });
    expect(detectPlayerRole(s)).toBe('Entry');
  });
  it('detects Support — low ADR + low KD', () => {
    const s = mkStats({ overallKd: 0.95, overallAdr: 65 });
    expect(detectPlayerRole(s)).toBe('Support');
  });
  it('detects Rifler fallback', () => {
    const s = mkStats({ overallKd: 1.05, overallHsPercent: 45, overallAdr: 78 });
    expect(detectPlayerRole(s)).toBe('Rifler');
  });
  it('prefers last30 over overall', () => {
    const s = mkStats({ overallKd: 0.9, overallAdr: 60, last30Kd: 1.3, last30HsPercent: 30, last30Adr: 80 });
    expect(detectPlayerRole(s)).toBe('AWP');
  });
  it('detects IGL — low KD + high WR + veteran', () => {
    const s = mkStats({ overallKd: 0.95, overallWinRate: 55, totalMatches: 800 });
    expect(detectPlayerRole(s)).toBe('IGL');
  });
});
