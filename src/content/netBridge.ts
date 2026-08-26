/**
 * Bridge for payloads dispatched by the MAIN-world network hook
 * (public/network-hook.js → CustomEvent 'f-insight:net-payload' on document).
 */
import { isInterceptableApiUrl } from '../services/interceptRules';

export interface InterceptedNetPayload {
  url: string;
  status: number;
  body: unknown;
}

export type NetPayloadListener = (payload: InterceptedNetPayload) => void;

const EVENT_NAME = 'f-insight:net-payload';

export class NetworkBridge {
  private listener: EventListener | null = null;

  start(onPayload: NetPayloadListener): void {
    this.stop();
    this.listener = (event: Event) => {
      try {
        const detail = (event as CustomEvent).detail as
          | { url?: unknown; status?: unknown; body?: unknown }
          | undefined;
        if (!detail || typeof detail.url !== 'string') return;
        // Defense-in-depth: the hook already filtered, but never trust the
        // page world blindly — re-validate the URL here.
        if (!isInterceptableApiUrl(detail.url)) return;
        // Only successful JSON-shaped responses are data. Error bodies
        // (4xx/5xx, e.g. rate-limit envelopes) must never reach the staging
        // pipeline — the MAIN-world XHR path does not check status itself.
        const status = typeof detail.status === 'number' ? detail.status : 0;
        if (status < 200 || status >= 300) return;
        if (!detail.body || typeof detail.body !== 'object') return;
        onPayload({ url: detail.url, status, body: detail.body });
      } catch (_) {
        /* a malformed event must never break the page or our engine */
      }
    };
    document.addEventListener(EVENT_NAME, this.listener, true);
  }

  stop(): void {
    if (this.listener) {
      document.removeEventListener(EVENT_NAME, this.listener, true);
      this.listener = null;
    }
  }
}
