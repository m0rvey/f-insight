/**
 * Live CS2 map pool — self-observing.
 *
 * The veto matrix needs the active map list before FACEIT renders its voting
 * entities (i.e. during ACCEPT). The previous approach probed a guessed
 * config URL (/config/mappool.json) which only ever produced HTTP 404 noise.
 * The pool now LEARNS instead of guessing: every intercepted match payload
 * that contains voting/map entities feeds an observed-pool cache (24 h TTL),
 * and getActiveMapPool() returns observed ∪ bundled. A room seen once makes
 * every future room's pre-veto matrix smarter — zero requests of our own.
 */
import { cacheManager } from './cacheManager';

const OBSERVED_CACHE_KEY = 'maps_observed_cache';
const OBSERVED_TTL = 24 * 60 * 60 * 1000; // 24 hours

/** Mirrors forecastEngine's DEFAULT_CS2_MAPS — baseline/fallback pool. */
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
  source: 'observed' | 'fallback';
}

function normalizeMapName(s: string): string {
  return s.replace(/^(cs2_|csgo_|de_)/, '').toLowerCase().trim();
}

/**
 * Tolerant parser for mappool-shaped configs: accepts a plain string array as
 * well as entity objects ({ name } | { map_name } | { id }) optionally nested
 * under maps/pool/entities keys. Kept exported for future config sources and
 * for the test-suite contract.
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
    const clean = normalizeMapName(candidate);
    if (clean) out.add(clean);
  }
  return Array.from(out);
}

/**
 * Pulls every recognizable map name out of an intercepted match payload
 * (raw API shape or our parsed FaceitMatchDetails — both supported).
 */
export function harvestMapNamesFromMatchPayload(raw: unknown): string[] {
  const p = raw as any;
  const names: string[] = [];

  const entities =
    p?.voting?.map?.entities ??
    p?.payload?.voting?.map?.entities ??
    p?.match?.voting?.map?.entities;
  if (Array.isArray(entities)) {
    for (const e of entities) {
      if (typeof e?.name === 'string') names.push(e.name);
      else if (typeof e?.id === 'string') names.push(e.id);
    }
  }

  const single = p?.map ?? p?.payload?.map ?? p?.match?.map;
  if (typeof single === 'string') names.push(single);
  else if (typeof single?.name === 'string') names.push(single.name);

  return names.map(normalizeMapName).filter(Boolean);
}

/** Merges freshly observed names into the persistent observed pool. */
export async function recordObservedMaps(names: string[]): Promise<void> {
  const clean = names.map(normalizeMapName).filter(Boolean);
  if (clean.length === 0) return;
  const prev = (await cacheManager.get<string[]>(OBSERVED_CACHE_KEY)) || [];
  const merged = Array.from(new Set([...prev, ...clean]));
  await cacheManager.set(OBSERVED_CACHE_KEY, merged, OBSERVED_TTL);
}

/**
 * Observed ∪ bundled. The union keeps the veto matrix complete even when
 * observation has only seen a subset of the active pool so far.
 */
export async function getActiveMapPool(): Promise<MapPoolResult> {
  const observed = await cacheManager.get<string[]>(OBSERVED_CACHE_KEY);
  if (observed && observed.length > 0) {
    return {
      maps: Array.from(new Set([...observed, ...FALLBACK_CS2_MAPS])),
      source: 'observed',
    };
  }
  return { maps: FALLBACK_CS2_MAPS, source: 'fallback' };
}
