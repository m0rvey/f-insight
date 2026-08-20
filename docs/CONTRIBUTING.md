# 🤝 Contributing to f-insight

Thank you for your interest in contributing to **f-insight**! We welcome bug reports, feature proposals, and pull requests from the community.

---

## 🛠️ Tech Stack & Standards

- **Extension Standard**: Chrome Manifest V3 (Service Worker & Content Scripts)
- **Frontend**: React 18, TypeScript (Strict), Tailwind CSS, Lucide React
- **Architecture**: Isolated Shadow DOM injection into FACEIT SPA
- **Build Tool**: Vite 6 + Custom Bundler (`scripts/build.js`)
- **Testing**: Vitest + Happy-DOM

---

## 🚀 Getting Started

### 1. Prerequisites
- Node.js `>= 18.0.0`
- npm `>= 9.0.0`

### 2. Setup & Installation
```bash
# Clone the repository
git clone https://github.com/m0rvey/f-insight.git
cd f-insight

# Install dependencies
npm install
```

### 3. Development & Testing
```bash
# Run unit tests
npm test

# Build extension bundle
npm run build
```

### 4. Loading the Extension in Your Browser
1. Open Google Chrome (or Brave / Edge / Opera).
2. Navigate to `chrome://extensions`.
3. Enable **Developer mode** (toggle in the top right).
4. Click **Load unpacked** and select the `dist/` folder.
5. Open any FACEIT CS2 match room to test your changes.

---

## 🧪 Guidelines & Architecture

- **Shadow DOM Isolation**: Injected components must render inside isolated Shadow DOM hosts to prevent style contamination with FACEIT.
- **Privacy by Design**: No telemetry, analytics, or user data tracking. Compute metrics locally.
- **Safety & Compliance**: Only use public APIs and DOM observers; never tamper with game memory or anti-cheat processes.
- **Unit Testing**: Include unit tests for algorithms (win probability, MR12 simulation, veto scores) under `tests/`.

---

## 📜 Pull Request Process

1. Fork the repo and create your feature branch: `git checkout -b feature/awesome-metric`.
2. Ensure tests and build succeed: `npm test && npm run build`.
3. Commit with Conventional Commits: `git commit -m "feat(veto): add dynamic weight tuning"`.
4. Open a Pull Request on GitHub.
