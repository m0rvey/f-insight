# 💻 Code Documentation — f-insight

This document outlines the architecture, data flows, and module contracts of `f-insight`.

---

## 🏛️ System Architecture

```
                                  ┌────────────────────────────────────────┐
                                  │      FACEIT CS2 Single Page App        │
                                  │   (https://www.faceit.com/en/cs2/room) │
                                  └───────────────────┬────────────────────┘
                                                      │ DOM & History API
                                                      ▼
┌───────────────────────────────────────────────────────────────────────────────────────────┐
│ CONTENT SCRIPT (Standalone IIFE in Shadow DOM)                                            │
│                                                                                           │
│  ┌────────────────┐       ┌─────────────────┐       ┌─────────────────┐                   │
│  │   SpaWatcher   │ ───▶  │   DomObserver   │ ───▶  │AutoActionsEngine│                   │
│  │ (URL & Routes) │       │ (rAF Throttled) │       │(Ready/IP Copy)  │                   │
│  └────────────────┘       └────────┬────────┘       └─────────────────┘                   │
│                                    │                                                      │
│                                    ▼                                                      │
│                   ┌─────────────────────────────────┐                                     │
│                   │      React 18 Micro-Roots       │                                     │
│                   │  - LobbySummaryBar (Match HUD)  │                                     │
│                   │  - VetoMatrix (Map Pool Delta)  │                                     │
│                   │  - PlayerBadge (Micro-Pill HUD) │                                     │
│                   │  - PlayerDetailFlyout (Modal)   │                                     │
│                   └────────────────┬────────────────┘                                     │
└────────────────────────────────────┼──────────────────────────────────────────────────────┘
                                     │ chrome.runtime.sendMessage()
                                     ▼
┌───────────────────────────────────────────────────────────────────────────────────────────┐
│ BACKGROUND SERVICE WORKER (Manifest V3)                                                   │
│                                                                                           │
│  ┌─────────────────────────────────────────────────────────────────────────────────────┐  │
│  │ BackgroundMessageHandler                                                            │  │
│  │  - FETCH_LOBBY_INSIGHT                                                              │  │
│  │  - FETCH_PLAYER_INSIGHT                                                             │  │
│  │  - INTERCEPTED_MATCH_PAYLOAD (match & profile payloads)                             │  │
│  │  - GET_SETTINGS / SAVE_SETTINGS                                                     │  │
│  │  - GET_CACHE_STATS / CLEAR_CACHE                                                    │  │
│  └──────────┬───────────────────────────────┬────────────────────────────┬─────────────┘  │
│             │                               │                            │                │
│             ▼                               ▼                            ▼                │
│  ┌────────────────────┐          ┌────────────────────┐       ┌────────────────────┐      │
│  │   forecastEngine   │          │     riskScorer     │       │  premadeDetector   │      │
│  │ - Adv. MR12 Predict│          │ - Red Flags (0-100)│       │ - Party Clustering │      │
│  │ - Team FCR Impact  │          │ - Steam Hours/Bans │       │ - Color Assignment │      │
│  │ - Player Form Eval │          │ - Suspicion Ratios │       │                    │      │
│  └────────────────────┘          └────────────────────┘       └────────────────────┘      │
│             │                               │                            │                │
│             └───────────────────────────────┼────────────────────────────┘                │
│                                             ▼                                             │
│                                  ┌────────────────────┐                                   │
│                                  │    cacheManager    │                                   │
│                                  │ (chrome.storage)   │                                   │
│                                  └──────────┬─────────┘                                   │
└─────────────────────────────────────────────┼─────────────────────────────────────────────┘
                                              │ HTTPS Requests
                                              ▼
                             ┌──────────────────────────────────┐
                             │ Public Faceit & Steam Web APIs   │
                             │  - api.faceit.com/match/v2/...   │
                             │  - api.faceit.com/stats/v1/...   │
                             │  - api.faceit.com/users/v1/...   │
                             │  - steamcommunity.com/...        │
                             └──────────────────────────────────┘
```

---

## 📦 Core Modules

### 1. `src/services/forecastEngine.ts`
- **`calculateTeamFcr(team)`**:
  Computes normalized Firepower Contribution Rating — rounded shares always total exactly $100\%$ (the residual is assigned to the largest contributor):
  $$\text{Power} = \frac{\text{Elo}}{1000} \times \min(2.5,\ \max(0.4,\ \text{KD})) \times \left(1 + \frac{\text{ADR} - 75}{150}\right)$$
  The K/D weight is capped at 2.5 so flawless 60/0 samples cannot swallow the whole share.
- **`evaluatePlayerForm(recentMatches, lifetimeKd, lifetimeAdr)`**:
  Compares last 5 games to baseline using **symmetric** thresholds: `HOT` ($\text{ratio} \geq 1.15$), `COLD` ($\text{ratio} \leq 1/1.15$), otherwise `STABLE`. A zero-death aggregate falls back to $\max(\text{baseline}, \text{kills}/(n \cdot 2))$ instead of masking the outlier with the baseline value.
- **`calculateAdvancedMatchPrediction(params)`**:
  Multi-factor CS2 prediction engine:
  - Base Elo curve; all inputs sanitized (non-finite → neutral default).
  - Selected Map delta ($\pm 12\%$) uses the same **Bayesian sample-weighted win rate** as the veto module — $(\text{wins} + 2.5)/(\text{matches} + 5)$ — and only applies when the combined sample reaches **10 matches**, so one lucky 3-0 cannot skew the odds.
  - Team Momentum & Hot/Cold players ($\pm 10\%$), Premade party size advantage ($\pm 8\%$), smurf-risk factor.
  - MR12 score simulation: overtime is flagged when $|p - 50| \leq 8$ (a genuine 12:12 risk); score buckets degrade smoothly from `13:11` down to `13:3`.

### 2. `src/services/riskScorer.ts`
- Calculates 0–100% Smurf & Anomaly Risk Score using weighted flags:
  - Matches-vs-Elo curve (e.g. Level 10 with < 150 matches): $+35$, extreme fresh accounts $+45$
  - Abnormal Win Rate / K/D / ADR spikes: $+12$ to $+30$
  - Private Steam Profile: scaled with Elo ($+6$ to $+25$) plus fresh-account/strong-performance modifiers
  - Game/VAC Bans: $+25$ — evaluated whenever ban data exists, independently of profile summary/playtime availability
  - Very low **or zero** CS2 hours on high-Elo public profiles: up to $+30$; veteran dampeners ($-10/-15$) for mature accounts
- **Data Availability Guard**: when lifetime aggregates are missing (`statsAvailable === false` after a partial API failure), all MATCHES_ELO / KD / WINRATE heuristics are skipped instead of misreading fabricated defaults (`totalMatches=0`, `kd=1.0`) as a "fresh account".

### 3. `src/services/eloLevels.ts`
- Encapsulates official CS2 FACEIT skill level brackets (Levels 1–10).
- Calculates exact points required to rank up ($\Delta \text{Next}$), buffer to demotion ($\Delta \text{Demotion}$), and linear completion percentage.

### 4. `src/services/faceitApi.ts` & `src/services/steamApi.ts`
- **In-Flight Request Deduplication**: Utilizes internal Promise maps to guarantee that parallel requests for the same match or player share a single network call, eliminating duplicate HTTP traffic. Rejected promises are removed via `finally`, so failures are never cached in-flight.
- **Timeout & Abort Guards**: Protects all network requests with `AbortController` (8s timeout for Faceit API, 6s timeout for Steam XML), preventing hung connections in service workers.
- **Input Sanitization & URL Validation**: Validates `matchId` and `playerId` parameters against `/^[a-zA-Z0-9.\-_]+$/` and applies `encodeURIComponent()`. Validates `steamId64` against `/^\d{5,25}$/` — an invalid ID is classified as a fetch error ("no data"), never as a private profile.
- **Numeric Sanitization**: All parsed stats pass through `toInt`/`toFloat` helpers that strip thousands separators (`"1,234" → 1234`) and coerce garbage (`"N/A"`) into safe fallbacks instead of `NaN`.
- **Match History Delta Tracking**: Extracts historical Elo data across past 50 matches to compute accurate per-game Elo gains/losses ($\pm 25$).
- **Global Request Pacing**: every own `api.faceit.com` call passes a shared tail-chained gate (`FACEIT_MIN_REQUEST_INTERVAL_MS = 400`); the lobby prefetch pool runs 2 workers × 400 ms. The single backoff retry on 429/503/403 injects a 2 s cooldown into the shared gate, so the entire queue waits out a throttle window instead of re-impaling it. This pacing exists because an unpaced 10-player analysis (~30 requests in ~4 s) used to starve FACEIT's own UI fetches and surface as "Action Failed" toasts.
- **`buildStatsFromInterceptedParts(playerId, {user?, stats?, time?})`**: composes `FaceitPlayerFullStats` from intercepted page-traffic parts through the same `parsePlayerPayload`; returns `null` when all parts are empty; partial parts degrade via the Data Availability Contract (`statsAvailable: false`), never fabricated zeros.

### 5. `src/services/cacheManager.ts`
- **LRU In-Memory Bound**: Caps in-memory cache at 500 entries, refreshing key positions on read/write and evicting oldest non-settings entries to prevent memory leaks during long browser sessions.
- **Chrome Storage Integration**: Dual-tier storage with memory fallback and `chrome.storage.local` persistence with custom TTLs (Match: 3m, Player Stats: 1h, Steam: 24h, Negative: 3m). The reserved `SETTINGS_KEY` survives eviction and clear operations.
- **Negative Caching**: Partial player payloads (`statsAvailable === false`) are cached with the short 3-minute negative TTL so a wrong "fresh account" snapshot is re-fetched quickly instead of poisoning lobbies for an hour. Failed Steam queries are never cached long-term (`fetchError` bypass).

### 5b. Data Availability Contract
The parser distinguishes **"unknown data"** from **"zero values"**: when the FACEIT stats endpoints fail (rate-limit/network), `parsePlayerPayload` marks the result `statsAvailable: false`. Consumers (`riskScorer`, background caching) treat missing lifetime aggregates as unknown rather than as legitimate zeros, preventing fabricated defaults from driving business logic. See ADR-002 in the central knowledge hub.
**UI application (v1.2.1):** the player flyout opens instantly on click even while stats are missing — it renders roster-derived placeholder stats (`statsAvailable: false`, nickname/Elo/level only) plus an amber "Partial stats" banner that distinguishes two honest states — recent matches built from page traffic vs. roster basics only; full analysis swaps in automatically on the next payload refresh. Clicking a player therefore never silently does nothing.

### 6. `src/content/shadowRoot.ts`
- Implements `CSSStyleSheet.replaceSync()` and `root.adoptedStyleSheets = [sheet]`.
- Shares a single compiled stylesheet instance across all Shadow DOM roots, minimizing V8 memory usage and ensuring 0ms stylesheet construction.

### 7. `src/content/domObserver.ts`
- **Mutation Noise Filtering**: Filters out self-mutations originating from f-insight's own Shadow DOM hosts (`#f-insight-*`) and ignores noisy live chat, clock timers, and toast notifications.
- **rAF Throttling**: Throttles DOM mutations using a 60ms buffer synchronized via `requestAnimationFrame`.
- **Element-Identity Target Dedupe**: targets are deduped per DOM container only — the roster row, the scoreboard row and FACEIT's profile-popup card of the SAME player each keep their own badge target. Nickname/context-based dedupe was removed: FACEIT's popup uses hashed class names that defeat context heuristics, so its copy used to be silently dropped (the missing profile-popup mini table, fixed in v1.2.1).
- **Per-Location Badge Hosts**: multiple containers of one player get stable `-locN` host-id suffixes and independent React roots, so locations never fight over a single root.
- **Leaf-Text Fallback & UUID Links**: when primary selectors miss roster rows, ANY leaf element (`span`/`div`/`td`/`p`/`h5`/`h6`, `[class*="nickname"]`) whose exact trimmed text matches a roster nickname recovers the row. The previous anchors-only walk reported "0/10 player rows located" on pages whose player rows carry no `<a>` at all (scoreboard tables render clickable spans). The scan early-exits once every roster nickname is found and never matches f-insight's own injected UI; profile links carrying account UUIDs resolve players by id.
- Seamlessly discovers FACEIT match containers and player roster items across all navigation tabs.

### 8. `src/content/autoActions.ts`
- **Scoped Element Lookups**: Scopes button lookups to active modal/dialog containers rather than scanning the entire document on each tick.
- **Context Guards & User Lock**: Implements a 3-second user activity lock after pointer/keyboard events to prevent synthetic clicks from colliding with user actions.

### 9. `src/components/player/PlayerRadarChart.tsx`
- Pure zero-dependency SVG geometry for a 5-axis player performance radar (Firepower, Damage, Precision, Winrate, Impact).
- Uses normalized coordinate transforms $(\theta = \frac{2\pi i}{5} - \frac{\pi}{2})$ with drop-shadow glow filters.

### 10. `scripts/build.js` Build Pipeline Optimization
- **Custom Lucide Icon Resolver**: Rewrites barrel icon imports into direct ESM imports at build time, shrinking module transformations from **1,800+ down to ~50–90** (a 97% reduction in transformed module graph) and cutting build times in half.
- **Rollup & Esbuild Optimizations**: Enforces `target: 'es2022'` with smallest treeshaking preset and debugger drops.

### 11. Passive Traffic Interception — v1.2.0 primary data source
- **`public/network-hook.js` (MAIN world, `document_start`)**: patches `window.fetch` / `XMLHttpRequest.prototype.open|send`, clones JSON responses whose URL matches `api.faceit.com` interception patterns (regex list without `$` anchors so query strings match), dispatches a namespaced CustomEvent `{url, status, body}`. Idempotent window guard; every step failure-isolated so the host SPA can never break.
- **`src/content/netBridge.ts` (isolated world)**: re-validates event payloads via the TS-mirrored rules in `src/services/interceptRules.ts`, forwards as `INTERCEPTED_MATCH_PAYLOAD`.
- **XHR json bodies**: XHR interception reads `this.response` when `responseType === 'json'` (accessing `responseText` in that mode throws `InvalidAccessError`, which used to silently drop every json-typed XHR FACEIT made); other modes fall back to `JSON.parse(responseText)`.
- **Background**: validates/extracts matchId → `parseMatchPayload` → caches `intercepted_match:{id}` (TTL 3 min). `getMatchDetails` checks this cache FIRST. Non-match URLs are routed to the profile pipeline below.
- **Profile payload hydration**: URLs that classify via `classifyInterceptedProfileUrl` (`user` / `stats` / `time` kinds, full-segment playerId validation) are staged per player in `intercept_profile:{playerId}` (~9 min TTL) and recomposed through `buildStatsFromInterceptedParts` into the standard `player_stats:{id}` cache on every new part. Badges and the flyout therefore hydrate from traffic the page itself loaded — zero own requests. Content forwards profile payloads with an 800 ms debounce and triggers one lobby refresh when a full composition lands.
- **Source ordering invariant**: intercepted page traffic is PRIMARY; f-insight's own paced `api.faceit.com` calls are FALLBACK ONLY. Own requests pass a global pacing gate (min interval, tail-chained queue) with a single backoff retry on 429/503/403. Preserve this ordering in future edits.

### 12. Self-Observing Map Pool — `src/services/mapPool.ts`
- **Learns instead of guessing**: the previous design probed a guessed config URL (`faceit.com/config/mappool.json`) which only ever produced HTTP 404 noise — and failures were neither cached nor rate-limited in logging. The pool now harvests map names from intercepted match payloads (`harvestMapNamesFromMatchPayload` accepts raw API shapes, parsed details, and single-map fields; `recordObservedMaps` merges them into a 24 h `maps_observed_cache`).
- **`getActiveMapPool()` returns observed ∪ bundled** (`FALLBACK_CS2_MAPS`): observation may know only a subset of the active pool, the bundled baseline keeps the veto matrix complete. The `source` field reports `'observed' | 'fallback'`.
- Zero network requests of its own. A room seen once makes every future room's pre-veto matrix smarter — the veto matrix works from the ACCEPT phase, before FACEIT renders voting entities. `parseMapPoolConfig` stays exported as the tolerant parser contract.

### 13. Content Resilience & Diagnostics — v1.2.1
- **Render-stage isolation**: main widget, player badges and flyout each render inside their own try/catch — one failing stage can no longer take down the others.
- **Global error hooks**: `window.onerror`-style listeners for `error` / `unhandledrejection` log under the `[f-insight:Content]` prefix so user-reported console output points at the real cause instead of a minified frame like `content.js:26 (Fd)`.
- **Homepage dormancy** (`disableOnHomeScreen`, Overview tab → "Extension Status"): outside `/room/*` pages the DOM observer stops and automations gate off entirely.
- The floating action button (QuickControls HUD) was removed in v1.2.1 together with its `enableFloatingControls` setting.

### 14. Lifecycle & Cache Integrity — post-v1.2.1 hardening
- **Per-pass root pruning**: `playerRoots` stores `{root, host}` pairs; every badge render pass unmounts and deletes entries whose host has left the DOM (profile popup closed, tab switched). Previously detached React trees stayed pinned until the room-level cleanup — a slow leak during active clicking sessions.
- **Orphan host sweep**: `-locN` occurrence ordinals depend on scan order; after FACEIT reorders its DOM a container could keep an orphaned shadow host under the OLD id, rendering as a phantom 6 px gap while a duplicate host appeared beside it. Host creation now sweeps stale `:scope > [id^="f-insight-player-"]` siblings first.
- **Hydration downgrade guard**: `streamLobbyData(forceRefresh)` no longer lets a throttled own fetch overwrite a good cached snapshot — e.g. one hydrated from intercepted traffic seconds earlier — with the fabricated `statsAvailable: false` object that `getPlayerStats` returns on failed endpoints. Fresh data is accepted only when it is at least as complete as the cached entry; otherwise the better entry is kept and broadcast.
- **README navigation**: all section anchors validated against GitHub's slug algorithm (the "Architecture" anchor used to point at a section that did not exist); both READMEs gained an Architecture section, refreshed feature lists, and a no-Node quick-install path (the repo ships a prebuilt `dist/`, so `npm install && npm run build` is optional; self-build requires Node ≥ 18 for Vite 6).
