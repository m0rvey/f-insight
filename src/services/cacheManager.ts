interface CacheEntry<T> {
  value: T;
  cachedAt: number;
  ttlMs: number;
}

export const TTL = {
  MATCH: 3 * 60 * 1000,        // 3 minutes
  PLAYER_STATS: 60 * 60 * 1000, // 1 hour (Aggressive caching)
  STEAM_PROFILE: 24 * 60 * 60 * 1000, // 24 hours
  NEGATIVE: 3 * 60 * 1000,     // 3 minutes for failed / unreachable queries
  SETTINGS: Number.MAX_SAFE_INTEGER,
} as const;

/** Reserved key that survives cache eviction and clear() operations. */
export const SETTINGS_KEY = 'settings';

const MAX_MEMORY_ENTRIES = 500;

class CacheManager {
  private memoryCache: Map<string, CacheEntry<unknown>> = new Map();

  private isChromeStorageAvailable(): boolean {
    return typeof chrome !== 'undefined' && !!chrome.storage?.local;
  }

  private enforceMemoryLimit() {
    if (this.memoryCache.size <= MAX_MEMORY_ENTRIES) return;
    // Map entries are ordered by insertion; delete the oldest non-settings entries
    const iter = this.memoryCache.keys();
    while (this.memoryCache.size > MAX_MEMORY_ENTRIES) {
      const next = iter.next();
      if (next.done) break;
      if (next.value !== SETTINGS_KEY) {
        this.memoryCache.delete(next.value);
      }
    }
  }

  async get<T>(key: string): Promise<T | null> {
    const now = Date.now();

    // 1. Try memory cache first
    const memItem = this.memoryCache.get(key);
    if (memItem) {
      if (now - memItem.cachedAt < memItem.ttlMs) {
        // Refresh LRU order on hit
        this.memoryCache.delete(key);
        this.memoryCache.set(key, memItem);
        return memItem.value as T;
      }
      this.memoryCache.delete(key);
    }

    // 2. Try chrome.storage.local
    if (this.isChromeStorageAvailable()) {
      try {
        const result = await chrome.storage.local.get([key]);
        const entry = result[key] as CacheEntry<T> | undefined;
        if (entry && entry.cachedAt && entry.ttlMs) {
          if (now - entry.cachedAt < entry.ttlMs) {
            // Populate memory cache for faster subsequent reads and enforce capacity
            this.memoryCache.set(key, entry);
            this.enforceMemoryLimit();
            return entry.value;
          }
          // Expired: delete
          await chrome.storage.local.remove([key]);
        }
      } catch (err) {
        console.warn(`[f-insight:Cache] Failed to read ${key} from storage`, err);
      }
    }

    return null;
  }

  async set<T>(key: string, value: T, ttlMs: number): Promise<void> {
    const entry: CacheEntry<T> = {
      value,
      cachedAt: Date.now(),
      ttlMs,
    };

    // If key exists, delete first so insertion order puts it at the end (MRU)
    this.memoryCache.delete(key);
    this.memoryCache.set(key, entry);
    this.enforceMemoryLimit();

    if (this.isChromeStorageAvailable()) {
      try {
        await chrome.storage.local.set({ [key]: entry });
      } catch (err) {
        console.warn(`[f-insight:Cache] Failed to save ${key} to storage`, err);
      }
    }
  }

  async remove(key: string): Promise<void> {
    this.memoryCache.delete(key);
    if (this.isChromeStorageAvailable()) {
      try {
        await chrome.storage.local.remove([key]);
      } catch (err) {
        console.warn(`[f-insight:Cache] Failed to remove ${key}`, err);
      }
    }
  }

  async clear(): Promise<void> {
    this.memoryCache.clear();
    if (this.isChromeStorageAvailable()) {
      try {
        // Clear all except settings
        const all = await chrome.storage.local.get(null);
        const keysToRemove = Object.keys(all).filter((k) => k !== SETTINGS_KEY);
        if (keysToRemove.length > 0) {
          await chrome.storage.local.remove(keysToRemove);
        }
      } catch (err) {
        console.warn('[f-insight:Cache] Failed to clear storage', err);
      }
    }
  }

  async cleanup(): Promise<void> {
    const now = Date.now();
    for (const [key, entry] of this.memoryCache.entries()) {
      if (now - entry.cachedAt >= entry.ttlMs) {
        this.memoryCache.delete(key);
      }
    }
    
    if (this.isChromeStorageAvailable()) {
      try {
        const all = await chrome.storage.local.get(null);
        const keysToRemove: string[] = [];
        
        for (const [key, val] of Object.entries(all)) {
          if (key === SETTINGS_KEY) continue;
          const entry = val as CacheEntry<unknown>;
          if (entry && entry.cachedAt && entry.ttlMs) {
            if (now - entry.cachedAt >= entry.ttlMs) {
              keysToRemove.push(key);
            }
          }
        }
        
        if (keysToRemove.length > 0) {
          await chrome.storage.local.remove(keysToRemove);
        }
      } catch (err) {
        console.warn('[f-insight:Cache] Failed to cleanup storage', err);
      }
    }
  }

  async getStats(): Promise<{ totalEntries: number; bytesInUse: number; keys: string[] }> {
    if (this.isChromeStorageAvailable()) {
      try {
        const all = await chrome.storage.local.get(null);
        const keys = Object.keys(all);
        const bytes = await chrome.storage.local.getBytesInUse(null);
        return {
          totalEntries: keys.length,
          bytesInUse: bytes,
          keys,
        };
      } catch (err) {
        console.warn('[f-insight:Cache] Failed to get stats', err);
      }
    }

    return {
      totalEntries: this.memoryCache.size,
      bytesInUse: 0,
      keys: Array.from(this.memoryCache.keys()),
    };
  }
}

export const cacheManager = new CacheManager();

