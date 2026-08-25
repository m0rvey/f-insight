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
│                   │  - LobbySummaryBar (Stakes HUD) │                                     │
│                   │  - VetoMatrix (Map Pool Delta)  │                                     │
│                   │  - PlayerBadge (Micro-Pill HUD) │                                     │
│                   │  - PlayerDetailFlyout (Modal)   │                                     │
│                   │  - QuickControls (Floating HUD) │                                     │
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
│  │  - GET_SETTINGS / SAVE_SETTINGS                                                     │  │
│  │  - GET_CACHE_STATS / CLEAR_CACHE                                                    │  │
│  └──────────┬───────────────────────────────┬────────────────────────────┬─────────────┘  │
│             │                               │                            │                │
│             ▼                               ▼                            ▼                │
│  ┌────────────────────┐          ┌────────────────────┐       ┌────────────────────┐      │
│  │   forecastEngine   │          │     riskScorer     │       │  premadeDetector   │      │
│  │ - Projected Elo    │          │ - Red Flags (0-100)│       │ - Party Clustering │      │
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
- **`calculateProjectedElo(f1AvgElo, f2AvgElo)`**:
  Computes expected win probabilities $E_1 = \frac{1}{1 + 10^{(\text{elo}_2 - \text{elo}_1)/400}}$ and points won/lost:
  $$\text{Gain} = \text{round}(50 \times (1 - E_1)), \quad \text{Loss} = \text{round}(50 \times E_1)$$
  Non-finite inputs fall back to the neutral 1000 Elo default; results are clamped to `+1..+49`.
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

### 5. `src/services/cacheManager.ts`
- **LRU In-Memory Bound**: Caps in-memory cache at 500 entries, refreshing key positions on read/write and evicting oldest non-settings entries to prevent memory leaks during long browser sessions.
- **Chrome Storage Integration**: Dual-tier storage with memory fallback and `chrome.storage.local` persistence with custom TTLs (Match: 3m, Player Stats: 1h, Steam: 24h, Negative: 3m). The reserved `SETTINGS_KEY` survives eviction and clear operations.
- **Negative Caching**: Partial player payloads (`statsAvailable === false`) are cached with the short 3-minute negative TTL so a wrong "fresh account" snapshot is re-fetched quickly instead of poisoning lobbies for an hour. Failed Steam queries are never cached long-term (`fetchError` bypass).

### 5b. Data Availability Contract
The parser distinguishes **"unknown data"** from **"zero values"**: when the FACEIT stats endpoints fail (rate-limit/network), `parsePlayerPayload` marks the result `statsAvailable: false`. Consumers (`riskScorer`, background caching) treat missing lifetime aggregates as unknown rather than as legitimate zeros, preventing fabricated defaults from driving business logic. See ADR-002 in the central knowledge hub.

### 6. `src/content/shadowRoot.ts`
- Implements `CSSStyleSheet.replaceSync()` and `root.adoptedStyleSheets = [sheet]`.
- Shares a single compiled stylesheet instance across all Shadow DOM roots, minimizing V8 memory usage and ensuring 0ms stylesheet construction.

### 7. `src/content/domObserver.ts`
- **Mutation Noise Filtering**: Filters out self-mutations originating from f-insight's own Shadow DOM hosts (`#f-insight-*`) and ignores noisy live chat, clock timers, and toast notifications.
- **rAF Throttling**: Throttles DOM mutations using a 60ms buffer synchronized via `requestAnimationFrame`.
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
