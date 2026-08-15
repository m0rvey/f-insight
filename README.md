# ⚡ f-insight — FACEIT CS2 Extension

<div align="center">

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Manifest](https://img.shields.io/badge/Manifest-V3-orange.svg)
![React](https://img.shields.io/badge/React-18-61dafb.svg)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3.4-38bdf8.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)
![Game](https://img.shields.io/badge/CS2-FACEIT%20Ready-ff5500.svg)

**Next-generation open-source browser extension for FACEIT CS2 delivering real-time lobby intelligence, matchmaking automation, and tactical match analysis.**

[Features](#-key-features) • [Installation](#-installation--quick-start) • [Documentation](#-documentation) • [Safety & ToS](#-safety--tos-compliance)

**English** • [Русская версия](docs/README_RU.md)

</div>

---

## 🎯 Overview

`f-insight` brings together real-time match analytics, smurf & red flag detection, matchmaking automation (auto-ready, connect IP copy), projected Elo stakes, and team firepower contribution ratings (FCR) into a single, high-performance, **zero-configuration** extension.

---

## ✨ Key Features

### 1. ⚡ Matchmaking Automation & QoL
- **Auto Ready-Up**: Automatically detects and accepts matches when the queue pops.
- **Auto-Accept Party Invites**: Automatically accepts invitations from friends.
- **1-Click Connect IP & Quick Copy**: Instantly copies `connect <ip:port>` and provides a 1-click `steam://connect` launch button.
- **Audio Chimes**: Plays a pleasant audio alert when the match server is configured and ready.
- **Projected Elo Stakes**: Shows exact points to win or lose (e.g. `+24 / -26 ELO`) for each match.

### 2. 🔮 Tactical Analytics & Performance Ratings
- **FCR (Firepower Contribution Rating)**: Calculates each player's firepower and impact share in their team (sums to 100%, $>25\%$ indicates star carry).
- **Player Form & Momentum**: Analyzes last 5 games vs baseline to highlight:
  - 🔥 **ON FIRE**: Peak performance ($>+15\%$ above normal K/D and ADR).
  - 🧊 **COLD / TILT**: Underperforming in recent matches.
  - ⚖️ **STABLE**: Consistent play.
- **ADR (Average Damage per Round)**: Displayed directly in lobby rosters and player profiles.
- **Map Veto Tactical Matrix**: Real-time team winrates, average K/D, and pick/ban recommendations on all 7 Active Duty maps.

### 3. 🚨 Smurf Risk Scorer & Red Flags (0–100%)
- **Smart Weighted Risk Scoring**: Flags low-match high-Elo accounts, abnormal winrates ($>70\%$), and K/D spikes.
- **Steam Profile Audit**: Detects CS2 hours, account age, and VAC/Game bans with `[Private Steam]` support.
- **Party / Premade Clustering**: Automatically detects and color-codes queue groups (`Party A`, `Party B`).

### 4. 🎨 Zero-Config & Pure Shadow DOM
- **100% Zero-Config**: Works out of the box using open FACEIT web endpoints. No API keys required.
- **Shadow DOM Encapsulation**: Isolated styles ensure zero visual glitches with FACEIT's web app.

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
