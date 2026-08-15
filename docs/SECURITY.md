# 🛡️ Security Policy & Audit Report — f-insight

## 🔒 Security Posture & Architecture

`f-insight` is designed with a **Privacy-First & Least-Privilege Architecture** for Chrome Extensions (Manifest V3).

---

## 📋 OWASP Top 10 Security Audit Results

| Category | Status | Details |
|---|---|---|
| **A01: Broken Access Control** | 🟢 PASSED | Extension background handler processes strictly typed internal messages. No unauthorized cross-origin messaging. Protocol links (`steam://connect`) strictly validate `IP:Port` format. |
| **A02: Cryptographic Failures** | 🟢 PASSED | All communication with FACEIT and Steam uses strict TLS 1.3 (HTTPS). No plaintext credentials. |
| **A03: Injection & XSS** | 🟢 PASSED | Zero `innerHTML`, `dangerouslySetInnerHTML`, or `eval()` usage. Dynamic parameters (`matchId`, `playerId`, `steamId64`) are strictly regex-validated and URL-encoded. |
| **A04: Insecure Design** | 🟢 PASSED | Pure Shadow DOM isolation (`attachShadow({ mode: 'open' })`) ensures extension styles and components cannot tamper with or be manipulated by host page scripts. |
| **A05: Security Misconfiguration** | 🟢 PASSED | Manifest V3 strict CSP enforced. Subdomains like `accounts.faceit.com` are explicitly excluded from content script injection. |
| **A06: Vulnerable Components** | 🟢 PASSED | `npm audit` returned **0 vulnerabilities**. Dependencies are pinned and audited. |
| **A07: Identification & Auth Failures** | 🟢 PASSED | Extension operates in 100% Zero-Config keyless mode. No user passwords or session tokens are stored or transmitted. |
| **A08: Software & Data Integrity** | 🟢 PASSED | Single-file standalone IIFE bundle (`dist/content.js`) with zero remote script execution. |
| **A09: Security Logging & Monitoring** | 🟢 PASSED | No sensitive user data or tokens logged to console. Errors sanitized. |
| **A10: Server-Side Request Forgery** | 🟢 PASSED | Outbound requests are restricted to `api.faceit.com` and `steamcommunity.com` with numeric ID validation. |

---

## 🛡️ Chrome Manifest V3 Permissions

- `storage`: Used solely to cache public match analytics and player statistics locally in `chrome.storage.local`.
- `alarms`: Used for periodic cache TTL garbage collection.
- `host_permissions`: Strictly scoped to:
  - `https://www.faceit.com/*`
  - `https://faceit.com/*`
  - `https://api.faceit.com/*`
  - `https://steamcommunity.com/*`

---

## 🚨 Reporting a Vulnerability

If you discover any security issues or potential vulnerabilities in `f-insight`, please report them responsibly via GitHub Issues with the `security` tag or contact the repository maintainers.
