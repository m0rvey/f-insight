# Security Policy & Audit Report

## Security Audit Log

- **Audit Date**: 2026-08-15
- **Scope**: Entire codebase (`src/`, `public/`, `scripts/`, `tests/`)
- **Version**: 1.1.0
- **Status**: 🟢 **PASSED** (0 Critical, 0 High, 0 Medium, 0 Low vulnerabilities)

---

## Executive Summary

A comprehensive security audit against **OWASP Top 10** standards, **Chrome Manifest V3 Security Guidelines**, and **Supply Chain Dependency Integrity** was conducted for the **f-insight** extension.

---

## Audit Findings & Verification

| Category | OWASP / Standard | Status | Details |
|---|---|---|---|
| **Secrets & Credentials** | A07:2021 Identification & Auth Failures | 🟢 **PASSED** | Zero hardcoded API keys, tokens, or credentials found. No `.env` leakages in VCS. |
| **Injection & DOM XSS** | A03:2021 Injection | 🟢 **PASSED** | Zero usage of `innerHTML`, `dangerouslySetInnerHTML`, `eval()`, `Function()`, or `document.write`. All dynamic values use React JSX text bindings. |
| **URL & Protocol Injection** | A01:2021 Broken Access Control | 🟢 **PASSED** | `steam://connect` links strictly validate IP:port format with `/^[a-zA-Z0-9.\-]+:\d+$/`. Player URLs encode nicknames with `encodeURIComponent`. Steam profile links strictly require numeric `/^\d{5,25}$/` IDs. |
| **API Parameter Validation** | A03:2021 Injection / SSRF | 🟢 **PASSED** | `matchId` and `playerId` parameters are strictly validated with `/^[a-zA-Z0-9.\-_]+$/` regex before constructing HTTP fetch endpoints. |
| **Manifest V3 Scoping** | Google Chrome Extension Security | 🟢 **PASSED** | Minimal permissions (`storage`, `alarms`, `clipboardWrite`). Host permissions strictly limited to `api.faceit.com`, `faceit.com`, and `steamcommunity.com`. |
| **Sensitive Page Exclusion** | Extension Isolation | 🟢 **PASSED** | Content scripts explicitly exclude `https://accounts.faceit.com/*` to prevent script execution on authentication and login forms. |
| **Shadow DOM Isolation** | CSS & DOM Hijacking | 🟢 **PASSED** | All UI elements mount inside isolated Shadow Roots using `attachShadow({ mode: 'open' })` with scoped styles. |
| **Supply Chain & Dependencies** | A06:2021 Vulnerable & Outdated Components | 🟢 **PASSED** | `npm audit` reported **0 vulnerabilities** across 195 audited packages. |

---

## Security Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                       Browser Tab                           │
│  ┌───────────────────────────────────────────────────────┐  │
│  │                   FACEIT Web App                      │  │
│  │                                                       │  │
│  │  ┌─────────────────────────────────────────────────┐  │  │
│  │  │        f-insight Content Script (Shadow DOM)    │  │  │
│  │  │  - Isolated DOM tree (cannot leak to host page) │  │  │
│  │  │  - Zero innerHTML / React JSX only              │  │  │
│  │  │  - Strictly sanitized parameters                │  │  │
│  │  └───────────────────────┬─────────────────────────┘  │  │
│  └──────────────────────────┼────────────────────────────┘  │
│                             │ Type-safe Chrome Messaging    │
│  ┌──────────────────────────▼────────────────────────────┐  │
│  │             Background Service Worker                 │  │
│  │  - Validated API calls (api.faceit.com, Steam XML)    │  │
│  │  - Network timeout guards (AbortController)           │  │
│  │  - LRU-capped local cache (no unbounded memory)       │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## Reporting a Vulnerability

We take security seriously. If you discover a security vulnerability within this project, please report it responsibly:

1. **Do NOT open a public GitHub issue.**
2. Send an email to the maintainer or create a Private Vulnerability Advisory on GitHub.
3. Provide a clear description and reproduction steps.
4. We will investigate and respond promptly with a patch.
