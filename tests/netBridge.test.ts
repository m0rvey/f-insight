// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NetworkBridge } from '../src/content/netBridge';

/**
 * Adversarial harness: the MAIN-world hook publishes via a CustomEvent any
 * page script could forge. The bridge must only forward well-shaped,
 * successful api.faceit.com payloads.
 */
describe('NetworkBridge', () => {
  let received: Array<{ url: string; status: number; body: unknown }> = [];
  let bridge: NetworkBridge;

  beforeEach(() => {
    received = [];
    bridge = new NetworkBridge();
    bridge.start((p) => received.push(p));
  });

  afterEach(() => {
    bridge.stop();
  });

  const dispatch = (detail: unknown) => {
    document.dispatchEvent(new CustomEvent('f-insight:net-payload', { detail }));
  };

  it('forwards a valid intercepted payload', () => {
    dispatch({ url: 'https://api.faceit.com/api/match/v2/match/abc123', status: 200, body: { ok: 1 } });
    expect(received).toHaveLength(1);
    expect(received[0].url).toContain('match/abc123');
    expect(received[0].body).toEqual({ ok: 1 });
  });

  it('drops non-2xx error envelopes before they reach staging', () => {
    // The MAIN-world XHR path does not check status; the bridge must.
    dispatch({ url: 'https://api.faceit.com/users/v1/users/x', status: 429, body: { error: 'rate-limited' } });
    dispatch({ url: 'https://api.faceit.com/users/v1/users/x', status: 503, body: {} });
    expect(received).toHaveLength(0);
  });

  it('drops non-object bodies and malformed events', () => {
    dispatch({ url: 'https://api.faceit.com/users/v1/users/x', status: 200, body: 'injected string' });
    dispatch({ url: 'https://api.faceit.com/users/v1/users/x', status: 200 });
    dispatch(undefined);
    dispatch({ status: 200, body: {} }); // missing url
    expect(received).toHaveLength(0);
  });

  it('rejects urls outside the intercepted endpoint set (forgery guard)', () => {
    vi.stubGlobal('console', { debug: vi.fn(), warn: vi.fn(), error: vi.fn(), log: vi.fn() } as any);
    dispatch({ url: 'https://evil.example.com/users/v1/users/x', status: 200, body: {} });
    dispatch({ url: 'https://api.faceit.com/shouts/v1/all', status: 200, body: {} });
    expect(received).toHaveLength(0);
    vi.unstubAllGlobals();
  });

  it('stop() detaches the listener', () => {
    bridge.stop();
    dispatch({ url: 'https://api.faceit.com/users/v1/users/x', status: 200, body: {} });
    expect(received).toHaveLength(0);
  });
});
