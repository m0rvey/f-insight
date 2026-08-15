# ⚡ f-insight — FACEIT CS2 Extension

<div align="center">

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Manifest](https://img.shields.io/badge/Manifest-V3-orange.svg)
![React](https://img.shields.io/badge/React-18-61dafb.svg)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3.4-38bdf8.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)
![Game](https://img.shields.io/badge/CS2-FACEIT%20Ready-ff5500.svg)

**Next-generation open-source browser extension for FACEIT CS2 delivering real-time lobby intelligence, matchmaking automation, multi-factor match predictions, and tactical map veto analysis.**

[Features](#-key-features) • [Installation](#-installation--quick-start) • [Documentation](#-documentation) • [Safety & ToS](#-safety--tos-compliance)

**English** • [Русская версия](docs/README_RU.md)

</div>

---

## 🎯 Overview

`f-insight` brings together real-time match room analytics, multi-factor CS2 win prediction & MR12 score simulation, smurf & red flag detection, matchmaking automation (auto-ready, connect IP copy), projected Elo stakes, and team firepower contribution ratings (FCR) into a single, high-performance, **100% zero-configuration** extension.

---

## ✨ Key Features

### 1. ⚡ Matchmaking Automation & QoL
- **Auto Ready-Up**: Automatically detects and accepts matches when the queue pops.
- **Auto-Accept Party Invites**: Automatically accepts lobby invitations from friends.
- **1-Click Connect IP & Quick Copy**: Instantly copies `connect <ip:port>` and provides a 1-click `steam://connect` launch button.
- **Audio Chimes**: Plays a pleasant audio alert when the match server is configured and ready.
- **Projected Elo Stakes**: Shows exact points won or lost (e.g. `+24 / -26 ELO`) for each team.
- **Live Server Geolocation**: Accurately recognizes Russian (Moscow, SPB, Yekaterinburg, Novosibirsk), CIS (Almaty, Astana, Minsk, Kyiv), and EU servers.

### 2. 🧠 Multi-Factor Prediction & Tactical Analytics
- **Multi-Factor CS2 Win Predictor**: Integrates Base Elo, Selected Map proficiency ($\pm 12\%$), Team Momentum & Hot/Cold player count ($\pm 10\%$), and Premade party cohesion ($\pm 8\%$).
- **MR12 Score Line Simulation**: Projects realistic match scores (e.g. `13 : 9` or `13 : 11 (OT Likely)`).
- **Map Veto & Action Plan**: Bayesian sample-weighted 7-map tactical matrix with **Priority 1: Best Pick** and **Priority 1: Must Ban** recommendations for captains.
- **Team Top Map**: Displayed in the main comparison bar alongside Avg Elo, Avg K/D, Avg ADR, and Avg HS%.
- **FCR (Firepower Contribution Rating)**: Calculates each player's firepower and impact share in their team (sums to 100%, $>25\%$ indicates star carry).

### 3. 🎴 Compact Player Stat Strips
- **Clean Bottom Stat Strip**: Mounts cleanly below each player card with K/D, ADR, HS%, and Win%.
- **Consecutive Win/Loss Streaks**: Real-time momentum indicator (e.g. `🔥 4W` or `🧊 3L`).
- **Player Form & Momentum**: 🔥 `ON FIRE` ($>+15\%$ above baseline) or 🧊 `COLD / TILT`.
- **1-Click FACEIT Stats Link**: Instant direct access to detailed CS2 statistics.

### 4. 🚨 Smurf Risk Scorer & Red Flags (0–100%)
- **Smart Weighted Risk Scoring**: Flags low-match high-Elo accounts, abnormal winrates ($>70\%$), and K/D spikes.
- **Steam Profile Audit**: Detects CS2 hours, account age, and VAC/Game bans with `[Private Steam]` support.
- **Party / Premade Clustering**: Automatically detects and color-codes queue groups (`Party A`, `Party B`).

### 5. ⌨️ Global Keyboard Hotkeys
- `Alt + V` (or `Alt + М`): Instant toggle for Map Veto & Action Plan matrix.
- `Alt + R` (or `Alt + К`): Instant force refresh of match room statistics.
- `Alt + H` (or `Alt + Р`): Instant toggle visibility of overlays & HUD.

---

## 🚀 Installation & Quick Start

1. Clone or download this repository:
   ```bash
   git clone https://github.com/m0rvey/f-insight.git
   cd f-insight
   ```
2. Install dependencies and build:
   ```bash
   npm install
   npm run build
   ```
3. Open Chrome / Brave / Edge and go to `chrome://extensions/`.
4. Enable **Developer mode** (top right).
5. Click **Load unpacked** and choose the `f-insight/dist` directory.
6. Open any FACEIT CS2 match room: `https://www.faceit.com/en/cs2/room/...`

---

## 📚 Documentation

Detailed documentation is available in the [`docs/`](docs/) directory:

- 💻 **[Architecture & Code Documentation](docs/CODE_DOCUMENTATION.md)** — Data flow diagrams, module contracts, and mathematical models.
- 🎯 **[Design Philosophy](docs/DESIGN_PHILOSOPHY.md)** — Core ideology, Zero-Config rationale, and competitive analytics design.
- 🛡️ **[Security Policy & OWASP Audit](docs/SECURITY.md)** — Security posture, permissions scope, and vulnerability disclosure policy.
- 🤝 **[Contributing Guidelines](docs/CONTRIBUTING.md)** — Guidelines for contributors, code standards, and local development.
- 📄 **[License (MIT)](docs/LICENSE)** — Open-source license terms.

---

## 🛡️ Safety & ToS Compliance

- ✅ **Safe & Read-Only First**: Analytics and overlays are strictly read-only.
- ⚙️ **Configurable Automation**: Auto-Ready and sound alerts can be toggled on/off in the extension popup.
- 🔒 **Privacy Focused**: Cache and settings are stored locally on your device in `chrome.storage.local`.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
