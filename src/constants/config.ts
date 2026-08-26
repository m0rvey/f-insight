/**
 * Centralized magic numbers — single source of truth for tuning.
 * All modules should import from here instead of hard-coding literals.
 * Values are the 2026-08-26 hardened defaults (see CODE_DOCUMENTATION.md:15).
 */

export const FACEIT_CONFIG = {
  /** Minimum gap between any two api.faceit.com requests (tail-chained queue) */
  MIN_REQUEST_INTERVAL_MS: 400,
  /** Backoff cooldown injected into shared gate on 429/503/403 */
  BACKOFF_COOLDOWN_MS: 2000,
  /** Base retry delay after throttle (plus jitter) */
  BACKOFF_RETRY_BASE_MS: 2500,
  /** Max jitter added to backoff retry */
  BACKOFF_RETRY_JITTER_MS: 2000,
  /** Abort timeout for FACEIT API fetches */
  REQUEST_TIMEOUT_MS: 8000,
  /** Regex for valid matchId/playerId (shared with interceptRules, steamApi) */
  ID_PATTERN: /^[a-zA-Z0-9.\-_]+$/,
  /** Valid room id pattern (allow hyphen) */
  ROOM_ID_PATTERN: /^[a-zA-Z0-9\-_]+$/,
} as const;

export const STEAM_CONFIG = {
  REQUEST_TIMEOUT_MS: 6000,
  STEAM_ID_PATTERN: /^\d{5,25}$/,
} as const;

export const CACHE_CONFIG = {
  MAX_MEMORY_ENTRIES: 500,
  TTL: {
    /** Lobby analysis (match_analysis:*) */
    MATCH_MS: 3 * 60 * 1000,
    /** Player stats (player_stats:*) */
    PLAYER_STATS_MS: 60 * 60 * 1000,
    /** Steam profile */
    STEAM_PROFILE_MS: 24 * 60 * 60 * 1000,
    /** Negative / partial payloads (also used for intercept staging ×3) */
    NEGATIVE_MS: 3 * 60 * 1000,
    /** Settings never expire */
    SETTINGS_MS: Number.MAX_SAFE_INTEGER,
    /** Observed map pool */
    OBSERVED_MAPS_MS: 24 * 60 * 60 * 1000,
    /** Intercepted match cache */
    INTERCEPTED_MATCH_MS: 3 * 60 * 1000,
    /** Intercept staging window = NEGATIVE × factor */
    INTERCEPT_STAGE_FACTOR: 3,
  },
} as const;

export const LOBBY_CONFIG = {
  /** Concurrent player fetches in streamLobbyData */
  CONCURRENCY: 2,
  /** Delay between players in the concurrency pool */
  CONCURRENCY_DELAY_MS: 400,
  /** Default delay in mapWithConcurrency (fallback) */
  MAP_WITH_CONCURRENCY_DEFAULT_DELAY_MS: 150,
} as const;

export const DOM_CONFIG = {
  /** rAF throttle buffer */
  THROTTLE_MS: 60,
  /** SPA poll fallback interval */
  POLL_INTERVAL_MS: 500,
} as const;

export const CONTENT_CONFIG = {
  MAX_ZERO_TARGET_ATTEMPTS: 20,
  WARN_AFTER_ZERO_TARGET_ATTEMPTS: 3,
  /** Early retries (attempts 1-3) */
  ZERO_TARGET_RETRY_EARLY_MS: 2000,
  /** Late retries (attempts 4+) */
  ZERO_TARGET_RETRY_LATE_MS: 6000,
  /** Disable text fallback after this many attempts (expensive walk) */
  TEXT_FALLBACK_DISABLE_AFTER: 5,
  /** Early retry threshold for text fallback toggle */
  ZERO_TARGET_EARLY_RETRY_COUNT: 3,
  LOAD_TIMEOUT_MS: 20_000,
  RETRY_DELAY_FIRST_MS: 5000,
  RETRY_DELAY_SECOND_MS: 15_000,
  MAX_RETRIES: 2,
  MAX_OBSERVED_IDENTITIES: 10,
  AUTO_ACTION_INTERVAL_MS: 800,
} as const;

export const AUTO_ACTION_CONFIG = {
  GLOBAL_CLICK_GAP_MS: 1500,
  USER_ACTIVITY_LOCK_MS: 3000,
  SAME_BUTTON_COOLDOWN_MS: 5000,
  DEFAULT_COOLDOWN_MS: 2000,
  READY_COOLDOWN_MS: 5000,
  VETO_COOLDOWN_MS: 8000,
} as const;

export const INTERCEPT_CONFIG = {
  PROFILE_DEBOUNCE_MS: 800,
  MATCH_DEBOUNCE_MS: 1500,
} as const;

export const BENIGN_ERROR_PATTERNS = [
  'ResizeObserver loop completed with undelivered notifications',
  'ResizeObserver loop limit exceeded',
] as const;

export const MAP_POOL_CONFIG = {
  // Active Duty 2026-01 (Valve): mirage/inferno/nuke/ancient/anubis/dust2/train
  // Overpass removed 04.2024, Vertigo removed 01.2025, Cache not in pool since 2019
  FALLBACK_MAPS: [
    'mirage',
    'inferno',
    'nuke',
    'ancient',
    'anubis',
    'dust2',
    'train',
  ] as const,
} as const;
