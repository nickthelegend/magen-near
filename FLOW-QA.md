# Flow QA

Captured with `node scripts/shots.mjs v4` (Playwright Chrome under the shared Chrome lock) at **1440×900** and **375×812 (2x)**, full page.
Screens live outside the repo in `orchestration/shots/magen/v4/` (qa.json records overflow and runtime errors per route).

| Route | What it shows | 1440 | 375 |
|---|---|---|---|
| `#/` | Landing: hero + readiness scan, Get Magen (extension zip, iOS build, web), drill duel with live receipts, one-transaction upgrade, stats, features, limits, FAQ, CTA | ✓ | ✓ |
| `#/scan/root.near` | Scan result: score gauge 15/100, checklist, keys, upgrade CTA | ✓ | ✓ |
| `#/app` | Overview: balance card, readiness, two locks, assets, recent activity | ✓ | ✓ |
| `#/app/send` | Send with the two-signature panel and the "leave out the quantum half" test | ✓ | ✓ |
| `#/app/receive` | QR + address | ✓ | ✓ |
| `#/app/activity` | Decoded on-chain history with filters (sent / received / refused / security) | ✓ | ✓ |
| `#/app/security` | What NEAR sees (live key list), the two locks, readiness checklist, backup, limits | ✓ | ✓ |
| `#/app/qday` | Q-Day switch, native key preview, remove-classical-key, native-key proof | ✓ | ✓ |
| `#/app/drill` | Key-recovery drill: plain vs Magen, attacker panel | ✓ | ✓ |
| `#/start`, `#/start/upgrade/<acct>`, `#/start/unlock` | Onboarding: upgrade in place, start fresh, unlock/restore | ✓ | ✓ |

**Result (Nov 14):** 24/24 captures, **0 horizontal overflow, 0 runtime errors**.

Phone layout: floating icon-only tab bar (Home, Activity, raised lattice-shield Send, Security, Drill) with a springing glow; labels kept for screen readers. The Chrome extension popup (380 px) reuses these screens; its approval window is 400×700.

Extension: `scripts/ext-e2e.mjs` drives the real extension in Chromium (`--load-extension`): popup upgrade-in-place, demo dApp connect, approval window "Signed twice", testnet result.
Phone: Release build on the iOS Simulator (iPhone 17 Pro): onboarding upgrade, send, receive, activity, Q-Day switch, remove classical key.

Signing pass v13: approval modal / phone-web bottom sheet at 1440×900, 375×844, 390×844; zero horizontal overflow after fixing the long pending-payment button label. Reject causes zero broadcasts. Screens: `orchestration/shots/magen/approval-reject-{1440,375,390}.png`; before fixes: `approval-before-{1440,375}.png`. Every filmed transaction also has `approval-<step>-1440.png` and `explorer-<step>.png`. Routes: start/upgrade, app/send, app/chains, app/private, app/security, app/qday.

Native iOS approval bottom sheet compiles in the Release artifact. The Simulator GUI was unavailable for this pass; new transaction footage is explicitly the web app, not a native-phone claim. NearValidate shows all six successes and execution plans. NEAR Rocks' current account page only displayed a key count, so the film uses the actual RPC-backed app key list after Q-Day.
