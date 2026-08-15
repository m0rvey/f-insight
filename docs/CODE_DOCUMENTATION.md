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
- **`calculateTeamFcr(team)`**:
  Computes normalized Firepower Contribution Rating ($100\%$ across 5 players):
  $$\text{Power} = \frac{\text{Elo}}{1000} \times \text{KD} \times \left(1 + \frac{\text{ADR} - 75}{150}\right)$$
- **`evaluatePlayerForm(recentMatches, lifetimeKd, lifetimeAdr)`**:
  Compares last 5 games to baseline to classify form into `HOT` ($>+15\%$), `COLD` ($<-15\%$), or `STABLE`.
- **`calculateAdvancedMatchPrediction(params)`**:
  Multi-factor CS2 prediction engine incorporating Base Elo curve, Selected Map winrate delta ($\pm 12\%$), Team Momentum & Hot/Cold players ($\pm 10\%$), Premade party size advantage ($\pm 8\%$), MR12 predicted score simulation (e.g. `13:9`), and star matchup head-to-head.

### 2. `src/services/riskScorer.ts`
- Calculates 0–100% Smurf & Anomaly Risk Score using weighted flags:
  - Low matches ($< 50$) with High Elo ($> 1800$): $+30$ to $+50$
  - Abnormal Win Rate ($> 70\%$): $+20$
  - Disproportionate K/D Spike ($> 1.6$): $+20$
  - Private Steam Profile: $+10$ (flagged)
  - Game/VAC Bans: $+25$

### 3. `src/services/eloLevels.ts`
- Encapsulates official CS2 FACEIT skill level brackets (Levels 1–10).
- Calculates exact points required to rank up ($\Delta \text{Next}$), buffer to demotion ($\Delta \text{Demotion}$), and linear completion percentage.

### 4. `src/services/faceitApi.ts` & `src/services/steamApi.ts`
- **In-Flight Request Deduplication**: Utilizes internal Promise maps to guarantee that parallel requests for the same match or player share a single network call, eliminating duplicate HTTP traffic.
- **Timeout & Abort Guards**: Protects all network requests with `AbortController` (8s timeout for Faceit API, 6s timeout for Steam XML), preventing hung connections in service workers.
- **Input Sanitization & URL Validation**: Validates `matchId` and `playerId` parameters against `/^[a-zA-Z0-9.\-_]+$/` and applies `encodeURIComponent()`. Validates `steamId64` against `/^\d{5,25}$/` to prevent SSRF and parameter injection.
- **Match History Delta Tracking**: Extracts historical Elo data across past 50 matches to compute accurate per-game Elo gains/losses ($\pm 25$).

### 5. `src/services/cacheManager.ts`
- **LRU In-Memory Bound**: Caps in-memory cache at 500 entries, refreshing key positions on read/write and evicting oldest non-settings entries to prevent memory leaks during long browser sessions.
- **Chrome Storage Integration**: Dual-tier storage with memory fallback and `chrome.storage.local` persistence with custom TTLs (Match: 3m, Player Stats: 1h, Steam: 24h, Negative: 3m).
- **Negative Caching**: Caches failed or unreachable queries with a 3-minute TTL to prevent spamming endpoints on network hiccups.

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
