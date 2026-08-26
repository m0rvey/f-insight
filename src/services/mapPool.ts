/**
 * Live CS2 map pool.
 *
 * The veto matrix used to depend entirely on `match.voting.map.entities`,
 * which only exists once the veto phase starts. FACEIT publishes the current
 * map configuration at /config/mappool.json — polling it (cached 6h) lets the
 * matrix and predictions work from the ACCEPT phase onward. A bundled list
 * remains the last-resort fallback for offline/failed fetches.
 */
import { cacheManager } from './cacheManager';

const MAPPOOL_URL = 'https://www.faceit.com/config/mappool.json';
const MAPPOOL_CACHE_KEY = 'maps_config_cache';
const MAPPOOL_TTL = 6 * 60 * 60 * 1000; // 6 hours
const FETCH_TIMEOUT_MS = 5000;

/** Mirrors forecastEngine's DEFAULT_CS2_MAPS — final offline fallback. */
export const FALLBACK_CS2_MAPS = [
  'mirage',
  'inferno',
  'nuke',
  'ancient',
  'anubis',
  'dust2',
  'vertigo',
  'cache',
  'train',
  'overpass',
];

export interface MapPoolResult {
  maps: string[];
  source: 'network' | 'fallback';
}

/**
 * Tolerant parser for the mappool config: accepts a plain string array as
 * well as entity objects ({ name } | { map_name } | { id }) optionally nested
 * under maps/pool/entities keys. Names are normalized the same way the veto
 * engine normalizes them (cs2_/csgo_/de_ prefixes stripped, lowercased).
 */
export function parseMapPoolConfig(raw: unknown): string[] {
  const holder = raw as { maps?: unknown; pool?: unknown; entities?: unknown } | null;
  const pool = Array.isArray(raw)
    ? raw
    : Array.isArray(holder?.maps)
      ? holder?.maps
      : Array.isArray(holder?.pool)
        ? holder?.pool
        : Array.isArray(holder?.entities)
          ? holder?.entities
          : null;
  if (!pool) return [];

  const out = new Set<string>();
  for (const item of pool) {
    const candidate =
      typeof item === 'string'
        ? item
        : typeof (item as { name?: unknown })?.name === 'string'
          ? (item as { name: string }).name
          : typeof (item as { map_name?: unknown })?.map_name === 'string'
            ? (item as { map_name: string }).map_name
            : typeof (item as { id?: unknown })?.id === 'string'
              ? (item as { id: string }).id
              : '';
    if (!candidate) continue;
    const clean = candidate.replace(/^(cs2_|csgo_|de_)/, '').toLowerCase().trim();
    if (clean) out.add(clean);
  }
  return Array.from(out);
}

async function fetchMapPoolConfig(): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(MAPPOOL_URL, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

export async function getActiveMapPool(): Promise<MapPoolResult> {
  try {
    const fresh = await cacheManager.get<string[]>(MAPPOOL_CACHE_KEY);
    if (fresh && fresh.length > 0) {
      return { maps: fresh, source: 'network' };
    }

    const parsed = parseMapPoolConfig(await fetchMapPoolConfig());
    if (parsed.length > 0) {
      await cacheManager.set(MAPPOOL_CACHE_KEY, parsed, MAPPOOL_TTL);
      return { maps: parsed, source: 'network' };
    }
  } catch (err) {
    console.warn('[f-insight:MapPool] Live map pool unavailable, using fallback:', err);
  }
  return { maps: FALLBACK_CS2_MAPS, source: 'fallback' };
}
