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

# Type check
npx tsc --noEmit

# Version & docs sync checks
npm run check:versions
npm run check:docs   # verifies README.md ↔ README_EN.md anchor & feature sync

# Build extension bundle
npm run build
# dist/ is intentionally tracked — verify it is up-to-date:
git diff --exit-code dist/
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
- **Docs DRY**: `docs/README.md` (RU primary) and `docs/README_EN.md` are translations — keep `Features`/`Architecture`/`Installation` tables and anchors in sync. A `<!-- SYNC-NOTE -->` at the top of each file reminds. CI runs `check:docs`.
- **Config Single Source**: Tune intervals/TTLs in `src/constants/config.ts` only — never hard-code `400`, `60`, `500` in modules.
- **Parser vs Client**: Pure FACEIT payload parsing lives in `src/services/faceitParser.ts`; network/pacing lives in `src/services/faceitApi.ts`.
- **Content Split**: `src/content/index.tsx` is the bootstrap; engine logic lives in `src/content/contentEngine.tsx`; concurrency helper in `src/utils/concurrency.ts`.

---

## 📜 Pull Request Process

1. Fork the repo and create your feature branch: `git checkout -b feature/awesome-metric`.
2. Ensure tests and build succeed: `npm test && npm run build`.
3. Commit with Conventional Commits: `git commit -m "feat(veto): add dynamic weight tuning"`.
4. Open a Pull Request on GitHub.
