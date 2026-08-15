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

### 3. `src/content/shadowRoot.ts`
- Implements `CSSStyleSheet.replaceSync()` and `root.adoptedStyleSheets = [sheet]`.
- Shares a single compiled stylesheet instance across all Shadow DOM roots, minimizing V8 memory usage and ensuring 0ms stylesheet construction.

### 4. `src/content/domObserver.ts`
- Throttles DOM mutations using a 60ms buffer synchronized via `requestAnimationFrame`.
- Seamlessly discovers FACEIT match containers and player roster items across all navigation tabs.
