# 🎯 Design Philosophy & Core Ideology — f-insight

`f-insight` was created to solve a fundamental problem in competitive CS2 matchmaking: **Information Asymmetry and Friction**.

---

## 🧭 Core Principles

### 1. ⚡ Zero-Config by Default (Frictionless Onboarding)
- **The Problem**: Traditional analytics extensions require users to register developer accounts, generate API keys, and copy-paste tokens before showing any data. 90% of casual players abandon setup.
- **The Solution**: `f-insight` operates in **100% Zero-Config mode** out of the box using public internal web endpoints. You install it, open a match room, and intelligence is instantly live.

### 2. 🛡️ Absolute Style & Runtime Isolation (Shadow DOM First)
- **The Problem**: Web extensions that inject raw CSS into host pages frequently break the host website's styles (z-index wars, font overrides, broken flexboxes).
- **The Solution**: Every widget in `f-insight` is rendered inside an isolated **Shadow DOM** (`attachShadow({ mode: 'open' })`) with inlined Tailwind CSS and `AdoptedStyleSheets`. Zero visual bleed in either direction.

### 3. 🎯 Truth-First Analytics (No Fake Metrics)
- **The Problem**: Many tools create arbitrary custom "levels" (e.g. Level 11–20) or misleading hype numbers.
- **The Solution**: `f-insight` grounds every metric in verifiable competitive mathematics:
  - Elo stakes based on Elo distribution formulas.
  - Form evaluated strictly against the player's personal historical baseline (last 5 games vs lifetime).
  - FCR firepower shares normalized to $100\%$ per team.

### 4. 🎮 Tier-1 Esports Broadcast Aesthetic
- **The Philosophy**: Analytics should look and feel like an elite tournament broadcast HUD.
  - Deep carbon dark tones (`#101012`) matching FACEIT's design DNA.
  - Micro-HUD pills with crisp borders, glow states, and responsive active clicks.
  - Intuitive visual indicators (🔥 On Fire, 🧊 Cold, Tug-of-War Win Probability bar).

### 5. 🔒 Respect for User Privacy & Game Integrity
- `f-insight` is **strictly client-side and read-only by default**.
- It does not modify game files, memory, or network packets.
- All cached profiles are stored locally on the player's machine in `chrome.storage.local`.

### 6. ⚡ Zero-Lag & Non-Invasive Performance
- **The Problem**: Heavy background polling, unthrottled DOM mutations, and duplicate network requests degrade browser performance, causing FPS drops or lag during gameplay.
- **The Solution**: 
  - Throttled DOM observation (60ms `rAF` buffering) that ignores irrelevant mutations (chat, timers, self-hosts).
  - In-flight request deduplication across concurrent tabs.
  - Bounded LRU in-memory caches (500 entries) preventing browser memory bloat.
  - Sub-second build pipeline with 97% fewer transformed modules.
