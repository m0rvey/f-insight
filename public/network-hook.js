/**
 * f-insight network hook — MAIN world script.
 *
 * Runs at document_start inside the page's JS context and passively observes
 * the JSON responses FACEIT's own SPA fetches from api.faceit.com (match
 * details on room open, veto transitions, etc.). Each relevant payload is
 * re-dispatched as a DOM CustomEvent so the isolated-world content script can
 * consume data the page ALREADY loaded — zero extra requests of our own,
 * which is what used to trip Cloudflare rate limits and surface "Action
 * Failed" errors across the site.
 *
 * Original implementation for f-insight (m0rvey). The interception technique
 * itself is a well-known extension pattern; this code is written from scratch.
 *
 * Safety rules:
 *  - every patch is wrapped so a failure here can never break FACEIT's page;
 *  - only GET-shaped JSON from api.faceit.com matching known endpoints is
 *    observed, and responses are cloned — never consumed;
 *  - idempotent: a window guard prevents double injection.
 */
(() => {
  if (window.__fInsightNetHooked) return;
  window.__fInsightNetHooked = true;

  const EVENT_NAME = 'f-insight:net-payload';

  // Known api.faceit.com endpoints worth observing. Keep in sync with
  // src/services/interceptRules.ts (defense-in-depth: the isolated world
  // re-validates before forwarding anything to the background worker).
  const INTERCEPT_PATTERNS = [
    /^\/api\/match\/v2\/match\/[^/?#]+/,
    /^\/users\/v1\/users\/[a-zA-Z0-9.\-_]+/,
    /^\/stats\/v1\/stats\/users\/[^/?#]+\/games\/cs2/,
    /^\/stats\/v1\/stats\/time\/users\/[^/?#]+\/games\/cs2/,
  ];

  const shouldIntercept = (rawUrl) => {
    try {
      const url = new URL(String(rawUrl), location.origin);
      if (url.hostname !== 'api.faceit.com') return false;
      const path = url.pathname + url.search;
      return INTERCEPT_PATTERNS.some((re) => re.test(path));
    } catch (_) {
      return false;
    }
  };

  const dispatch = (url, status, body) => {
    try {
      document.dispatchEvent(
        new CustomEvent(EVENT_NAME, { detail: { url: String(url), status, body } })
      );
    } catch (_) {}
  };

  const isJsonResponse = (res) => {
    try {
      const ct = res.headers && res.headers.get ? res.headers.get('content-type') || '' : '';
      return ct.includes('json');
    } catch (_) {
      return false;
    }
  };

  // ── window.fetch patch ────────────────────────────────────────────────
  const origFetch = window.fetch;
  if (typeof origFetch === 'function') {
    window.fetch = function patchedFetch(input) {
      const promise = origFetch.apply(this, arguments);
      try {
        const url = typeof input === 'string' ? input : (input && input.url) || '';
        if (shouldIntercept(url)) {
          promise
            .then((res) => {
              if (!res || !res.ok || !isJsonResponse(res)) return;
              // clone(): the page keeps consuming its own body untouched
              return res.clone().json().then((body) => dispatch(url, res.status, body));
            })
            .catch(() => {});
        }
      } catch (_) {}
      return promise;
    };
  }

  // ── XMLHttpRequest patch ──────────────────────────────────────────────
  const origOpen = XMLHttpRequest.prototype.open;
  const origSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (method, url) {
    try {
      this.__fInsightUrl = String(url);
    } catch (_) {}
    return origOpen.apply(this, arguments);
  };
  XMLHttpRequest.prototype.send = function () {
    try {
      const url = this.__fInsightUrl;
      if (url && shouldIntercept(url)) {
        this.addEventListener('load', () => {
          try {
            const ct =
              this.getResponseHeader && this.getResponseHeader('content-type');
            if (!ct || !String(ct).includes('json')) return;
            // responseType='json' makes responseText access THROW
            // (InvalidAccessError) — read this.response instead. FACEIT's SPA
            // uses json-typed XHRs for some profile endpoints.
            let body;
            if (this.responseType === 'json') {
              body = this.response;
            } else {
              body = JSON.parse(this.responseText);
            }
            if (body && typeof body === 'object') dispatch(url, this.status, body);
          } catch (_) {}
        });
      }
    } catch (_) {}
    return origSend.apply(this, arguments);
  };
})();
