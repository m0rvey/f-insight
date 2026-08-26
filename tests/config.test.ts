import { describe, it, expect } from 'vitest';
import {
  CACHE_CONFIG,
  FACEIT_CONFIG,
  LOBBY_CONFIG,
  CONTENT_CONFIG,
  AUTO_ACTION_CONFIG,
  INTERCEPT_CONFIG,
} from '../src/constants/config';

describe('config — centralized magic numbers', () => {
  it('FACEIT pacing invariants hold (protects Action Failed)', () => {
    expect(FACEIT_CONFIG.MIN_REQUEST_INTERVAL_MS).toBe(400);
    expect(FACEIT_CONFIG.BACKOFF_COOLDOWN_MS).toBe(2000);
    expect(FACEIT_CONFIG.REQUEST_TIMEOUT_MS).toBe(8000);
    // Backoff retry must be longer than cooldown so gate stays hot
    expect(FACEIT_CONFIG.BACKOFF_RETRY_BASE_MS).toBeGreaterThanOrEqual(FACEIT_CONFIG.BACKOFF_COOLDOWN_MS);
  });

  it('cache TTLs are sane and match CODE_DOCUMENTATION.md:5', () => {
    expect(CACHE_CONFIG.MAX_MEMORY_ENTRIES).toBe(500);
    expect(CACHE_CONFIG.TTL.MATCH_MS).toBe(3 * 60 * 1000);
    expect(CACHE_CONFIG.TTL.PLAYER_STATS_MS).toBe(60 * 60 * 1000);
    expect(CACHE_CONFIG.TTL.NEGATIVE_MS).toBe(3 * 60 * 1000);
    expect(CACHE_CONFIG.TTL.INTERCEPT_STAGE_FACTOR).toBe(3);
  });

  it('lobby concurrency stays gentle (2 workers × 400 ms)', () => {
    expect(LOBBY_CONFIG.CONCURRENCY).toBe(2);
    expect(LOBBY_CONFIG.CONCURRENCY_DELAY_MS).toBe(400);
  });

  it('content retry and dormancy constants are bounded', () => {
    expect(CONTENT_CONFIG.MAX_ZERO_TARGET_ATTEMPTS).toBe(20);
    expect(CONTENT_CONFIG.WARN_AFTER_ZERO_TARGET_ATTEMPTS).toBe(3);
    expect(CONTENT_CONFIG.LOAD_TIMEOUT_MS).toBe(20_000);
    expect(CONTENT_CONFIG.MAX_OBSERVED_IDENTITIES).toBe(10);
  });

  it('auto-action gaps prevent synthetic click collisions', () => {
    expect(AUTO_ACTION_CONFIG.GLOBAL_CLICK_GAP_MS).toBe(1500);
    expect(AUTO_ACTION_CONFIG.USER_ACTIVITY_LOCK_MS).toBe(3000);
    expect(AUTO_ACTION_CONFIG.DEFAULT_COOLDOWN_MS).toBeLessThan(AUTO_ACTION_CONFIG.SAME_BUTTON_COOLDOWN_MS);
  });

  it('intercept debounces absorb bursts', () => {
    expect(INTERCEPT_CONFIG.PROFILE_DEBOUNCE_MS).toBe(800);
    expect(INTERCEPT_CONFIG.MATCH_DEBOUNCE_MS).toBe(1500);
  });
});
