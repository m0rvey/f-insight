<div align="center">

# ⚡ f-insight

**Modern Chrome extension for FACEIT CS2 delivering real-time lobby telemetry, MR12 win predictions, smurf detection, and tactical veto analysis.**

[![Manifest V3](https://img.shields.io/badge/Manifest-V3-4285F4?style=flat-square&logo=googlechrome&logoColor=white)](https://developer.chrome.com/docs/extensions/mv3/intro/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18-20232A?style=flat-square&logo=react&logoColor=61DAFB)](https://react.dev/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3.4-38B2AC?style=flat-square&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Game](https://img.shields.io/badge/CS2-FACEIT%20Ready-FF5500?style=flat-square)](https://www.faceit.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](../LICENSE)

[Features](#-key-features) • [Installation](#-installation--build) • [Architecture](#-architecture) • [Safety & ToS](#-safety--tos-compliance) • [Русская версия (Основная)](README.md)

</div>

---

## 📌 Overview

**f-insight** combines real-time match room analytics, multi-factor win prediction, scoreline simulation (MR12), heuristic smurf scoring, and automated QoL features into a lightweight, zero-configuration browser extension built on Chrome Manifest V3.

---

## ✨ Key Features

<table>
  <tr>
    <td width="50%" valign="top">
      <h4>⚡ Matchmaking Automation & QoL</h4>
      <ul>
        <li><b>Auto Ready-Up:</b> Automatically confirms check-in when match pops.</li>
        <li><b>Anti-AFK Protection:</b> Dismisses "Are you still here?" modal dialogs.</li>
        <li><b>1-Click Connect IP:</b> Instant copy of <code>connect &lt;ip:port&gt;</code> and steam URL launcher.</li>
      </ul>
    </td>
    <td width="50%" valign="top">
      <h4>🧠 Multi-Factor MR12 Win Predictor</h4>
      <ul>
        <li><b>Synergy Model:</b> Combines Base Elo, map proficiency (±12%), team momentum (±10%), and party cohesion (±8%).</li>
        <li><b>Scoreline Simulation:</b> Projects realistic match scores (e.g. <code>13 : 9</code> or <code>13 : 11 OT</code>).</li>
        <li><b>FCR (Firepower Rating):</b> Measures individual firepower and impact share.</li>
      </ul>
    </td>
  </tr>
  <tr>
    <td width="50%" valign="top">
      <h4>🗺️ Tactical Map Veto Assistant</h4>
      <ul>
        <li><b>CS2 Map Pool:</b> Dynamic scoring for Mirage, Inferno, Nuke, Dust2, Ancient, Anubis, Cache, Train, Overpass.</li>
        <li><b>Captains Action Plan:</b> Recommends Priority 1 Best Picks and Must Bans based on opponent winrates.</li>
        <li><b>Hotkeys:</b> Press <code>Alt + V</code> to toggle the full veto matrix overlay.</li>
      </ul>
    </td>
    <td width="50%" valign="top">
      <h4>🚨 Smurf Risk Scorer & Radar</h4>
      <ul>
        <li><b>Heuristic Scoring (0–100%):</b> Flags low-match high-Elo accounts with anomalous stats.</li>
        <li><b>Steam Profile Audit:</b> Checks CS2 hours, account age, and VAC/Game bans.</li>
        <li><b>5-Axis Skill Radar:</b> SVG spider chart of Firepower, Damage, Precision, Winrate, and Impact.</li>
      </ul>
    </td>
  </tr>
</table>

---

## 🛠️ Installation & Build

### Build from source

```bash
# 1. Clone the repository
git clone https://github.com/m0rvey/f-insight.git
cd f-insight

# 2. Install dependencies
npm install

# 3. Build the extension bundle
npm run build
```

The compiled extension will be generated inside the `dist/` directory.

### Load in Google Chrome / Brave / Edge
1. Navigate to `chrome://extensions/` in your browser.
2. Enable **Developer mode** (toggle in the top right).
3. Click **Load unpacked** and select the `dist/` folder from this repository.

---

## 🔒 Safety & ToS Compliance

- **Non-Intrusive:** Uses public FACEIT match APIs and DOM observers without tampering with game memory or anti-cheat processes.
- **Zero Botting:** All actions mimic legitimate browser interactions (QoL UI enhancements only).
- **Privacy:** Operates locally on client machine without transmitting user credentials or tokens.

---

## 📄 License

Distributed under the **MIT License**. See [LICENSE](../LICENSE) for more information.  
Crafted by [m0rvey](https://github.com/m0rvey).
