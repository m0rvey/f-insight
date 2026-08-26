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
import { CACHE_CONFIG, MAP_POOL_CONFIG } from '../constants/config';

const OBSERVED_CACHE_KEY = 'maps_observed_cache';
const OBSERVED_TTL = CACHE_CONFIG.TTL.OBSERVED_MAPS_MS;

/** Mirrors forecastEngine's DEFAULT_CS2_MAPS — baseline/fallback pool. */
export const FALLBACK_CS2_MAPS = [...MAP_POOL_CONFIG.FALLBACK_MAPS] as string[];

export interface MapPoolResult {
  maps: string[];
  source: 'observed' | 'fallback';
}

function normalizeMapName(s: string): string {
  return s.replace(/^(cs2_|csgo_|de_)/i, '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '');
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
 * Covers entities, pick arrays, veto, and guid→name where possible.
 */
export function harvestMapNamesFromMatchPayload(raw: unknown): string[] {
  const p = raw as any;
  const bag: any[] = [];

  // Primary voting entities (various envelope shapes)
  const entities =
    p?.voting?.map?.entities ??
    p?.payload?.voting?.map?.entities ??
    p?.match?.voting?.map?.entities ??
    p?.voting?.veto?.entities ??
    p?.payload?.voting?.veto?.entities;
  if (Array.isArray(entities)) bag.push(...entities);

  // Picks are map names directly (FACEIT accumulates picks in order)
  const picks = p?.voting?.map?.pick ?? p?.payload?.voting?.map?.pick ?? p?.match?.voting?.map?.pick;
  if (Array.isArray(picks)) {
    for (const n of picks) if (typeof n === 'string') bag.push({ name: n });
  }

  // Single map during ON_GOING/selected_map
  const single = p?.map ?? p?.payload?.map ?? p?.match?.map ?? p?.selected_map ?? p?.payload?.selected_map;
  if (typeof single === 'string') bag.push({ name: single });
  else if (single && typeof single?.name === 'string') bag.push({ name: single.name });

  const names: string[] = [];
  for (const e of bag) {
    let name = (typeof e === 'string' ? e : e?.name ?? e?.id ?? e?.guid ?? e?.map_name ?? '') as string;
    if (!name || typeof name !== 'string') continue;
    // UUID guid without name mapping — ignore (would pollute pool with "123e4567-...")
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(name)) continue;
    // Strip prefixes and normalize
    const norm = normalizeMapName(name);
    if (norm) names.push(norm);
  }

  return Array.from(new Set(names));
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
