// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { parseMapPoolConfig, getActiveMapPool, FALLBACK_CS2_MAPS } from '../src/services/mapPool';
import { cacheManager } from '../src/services/cacheManager';

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

describe('getActiveMapPool', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns network data on success and caches it (second call hits cache)', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ['de_cache', 'de_train'],
    });
    vi.stubGlobal('fetch', fetchMock);

    const first = await getActiveMapPool();
    expect(first.source).toBe('network');
    expect(first.maps).toEqual(['cache', 'train']);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const second = await getActiveMapPool();
    expect(second.source).toBe('network');
    expect(second.maps).toEqual(['cache', 'train']);
    expect(fetchMock).toHaveBeenCalledTimes(1); // served from cacheManager
    await cacheManager.set('maps_config_cache', [], 1); // clear for other tests
  });

  it('falls back to the bundled pool when fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    const result = await getActiveMapPool();
    expect(result.source).toBe('fallback');
    expect(result.maps).toEqual(FALLBACK_CS2_MAPS);
  });

  it('falls back when the response shape is unparseable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ nope: true }) }));
    const result = await getActiveMapPool();
    expect(result.source).toBe('fallback');
  });
});
