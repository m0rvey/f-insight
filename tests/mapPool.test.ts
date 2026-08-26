// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import {
  parseMapPoolConfig,
  getActiveMapPool,
  harvestMapNamesFromMatchPayload,
  recordObservedMaps,
  FALLBACK_CS2_MAPS,
} from '../src/services/mapPool';
import { cacheManager } from '../src/services/cacheManager';

const OBSERVED_KEY = 'maps_observed_cache';

describe('parseMapPoolConfig', () => {
  it('parses a plain string array', () => {
    expect(parseMapPoolConfig(['de_mirage', 'de_nuke', 'de_dust2'])).toEqual(['mirage', 'nuke', 'dust2']);
  });

  it('parses entity objects with name / map_name / id fields', () => {
    expect(parseMapPoolConfig([{ name: 'de_inferno' }, { map_name: 'de_vertigo' }, { id: 'de_ancient' }])).toEqual([
      'inferno',
      'vertigo',
      'ancient',
    ]);
  });

  it('unwraps nested maps / pool / entities containers', () => {
    expect(parseMapPoolConfig({ maps: ['de_mirage'] })).toEqual(['mirage']);
    expect(parseMapPoolConfig({ pool: ['de_nuke'] })).toEqual(['nuke']);
    expect(parseMapPoolConfig({ entities: [{ name: 'de_anubis' }] })).toEqual(['anubis']);
  });

  it('dedupes and drops empty entries', () => {
    expect(parseMapPoolConfig(['de_mirage', '', 'cs2_mirage', null, { name: '' }])).toEqual(['mirage']);
  });

  it('returns an empty array for unknown shapes', () => {
    expect(parseMapPoolConfig(null)).toEqual([]);
    expect(parseMapPoolConfig({ something: 42 })).toEqual([]);
    expect(parseMapPoolConfig('de_mirage')).toEqual([]);
  });
});

describe('harvestMapNamesFromMatchPayload', () => {
  it('extracts voting entity names from the raw API shape', () => {
    const raw = {
      voting: { map: { entities: [{ name: 'de_mirage' }, { id: 'de_nuke' }, { junk: true }] } },
    };
    expect(harvestMapNamesFromMatchPayload(raw)).toEqual(['mirage', 'nuke']);
  });

  it('supports the parsed-details envelope and a single ongoing-room map', () => {
    const parsed = { payload: { voting: { map: { entities: [{ name: 'cs2_ancient' }] } }, map: { name: 'de_dust2' } } };
    expect(harvestMapNamesFromMatchPayload(parsed)).toEqual(['ancient', 'dust2']);
    expect(harvestMapNamesFromMatchPayload({ map: 'de_train' })).toEqual(['train']);
  });

  it('returns nothing for payloads without any map info', () => {
    expect(harvestMapNamesFromMatchPayload({ status: 'READY' })).toEqual([]);
    expect(harvestMapNamesFromMatchPayload(null)).toEqual([]);
  });
});

describe('getActiveMapPool (self-observing)', () => {
  beforeEach(async () => {
    document.body.innerHTML = '';
    await cacheManager.set(OBSERVED_KEY, [], 1);
  });

  it('falls back to the bundled pool when nothing has been observed yet', async () => {
    const result = await getActiveMapPool();
    expect(result.source).toBe('fallback');
    expect(result.maps).toEqual(FALLBACK_CS2_MAPS);
  });

  it('returns observed ∪ bundled once maps have been learned from traffic', async () => {
    await recordObservedMaps(['de_grind', 'cs2_mirage']);
    const result = await getActiveMapPool();
    expect(result.source).toBe('observed');
    // Observed names come first; the bundled list keeps the matrix complete.
    expect(result.maps[0]).toBe('grind');
    expect(result.maps).toContain('mirage');
    expect(result.maps).toContain('inferno');
  });

  it('merges repeated observations without duplicates', async () => {
    await recordObservedMaps(['de_mirage']);
    await recordObservedMaps(['de_mirage', 'de_overpass']);
    const result = await getActiveMapPool();
    const uniq = new Set(result.maps);
    expect(uniq.size).toBe(result.maps.length);
    expect(result.maps.filter((m) => m === 'mirage')).toHaveLength(1);
  });
});
