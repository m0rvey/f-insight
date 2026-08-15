# Contributing to f-insight

Thank you for your interest in contributing to **f-insight**! We welcome bug reports, feature requests, and pull requests from the community.

## 🛠️ Tech Stack

- **Extension Standard**: Chrome Manifest V3
- **Frontend**: React 18, TypeScript, Tailwind CSS, Lucide React
- **Architecture**: Isolated Shadow DOM injection into FACEIT SPA
- **Build Tool**: Vite 6
- **Testing**: Vitest

## 🚀 Getting Started

### 1. Prerequisites
- Node.js (v18 or newer)
- npm or pnpm / bun

### 2. Installation
```bash
git clone https://github.com/your-username/f-insight.git
cd f-insight
npm install
```

### 3. Development Mode
Run the build watcher or tests:
```bash
# Run unit tests
npm test

# Build extension for loading into Chrome
npm run build
```

### 4. Loading the Extension in Your Browser
1. Open Google Chrome (or Brave / Edge / Opera).
2. Navigate to `chrome://extensions`.
3. Enable **Developer mode** (top right switch).
4. Click **Load unpacked** and select the `dist/` directory inside `f-insight`.
5. Open any FACEIT CS2 match room (e.g. `https://www.faceit.com/en/cs2/room/...`) to see the extension in action!

## 🧪 Coding Guidelines & Standards

- **ToS Compliance**: `f-insight` is strictly a read-only analytics extension. Do not implement automated actions, auto-clicking, auto-accepting, or any features that mimic human input.
- **Shadow DOM Isolation**: All injected components must render inside isolated Shadow DOM hosts so that external styles do not bleed into FACEIT and FACEIT styles do not break our UI.
- **Unit Testing**: Add unit tests for new algorithm features (scoring, parsing, caching) under `tests/`.

## 📜 Pull Request Process

1. Fork the repo and create your feature branch: `git checkout -b feature/awesome-metric`.
2. Ensure tests and build pass: `npm test && npm run build`.
3. Commit your changes: `git commit -m "feat: add clutch percentage metric"`.
4. Push to the branch: `git push origin feature/awesome-metric`.
5. Open a Pull Request.
