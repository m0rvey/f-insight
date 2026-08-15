import { describe, it, expect, beforeEach } from 'vitest';
import { cacheManager } from '../src/services/cacheManager';

describe('cacheManager', () => {
  beforeEach(async () => {
    await cacheManager.clear();
  });

  it('should set and get cached items within TTL', async () => {
    await cacheManager.set('test:key1', { hello: 'world' }, 10000);
    const val = await cacheManager.get<{ hello: string }>('test:key1');
    expect(val).toEqual({ hello: 'world' });
  });

  it('should return null for expired items', async () => {
    await cacheManager.set('test:expired', { temp: true }, -100);
    const val = await cacheManager.get('test:expired');
    expect(val).toBeNull();
  });

  it('should remove items on demand', async () => {
    await cacheManager.set('test:remove', 123, 10000);
    await cacheManager.remove('test:remove');
    const val = await cacheManager.get('test:remove');
    expect(val).toBeNull();
  });
});
