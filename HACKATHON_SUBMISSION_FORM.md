# Magen · NEAR HACKATHON 2026 submission

**Project:** Magen (מגן, Hebrew for "shield")
**One line:** Keep your NEAR account. Add a second lock a quantum computer can't pick.
**Tracks:** security (primary), open.
**Built:** Nov 13–14 2026, fresh codebase (see Prior work).

## What it is
A quantum-safe NEAR wallet on three surfaces that share one SDK:
- **Chrome extension (MV3):** popup wallet plus a `window.magen` dApp provider; every dApp request opens an approval window that shows "Signed twice: classical + quantum-safe".
- **iPhone app (Expo, Release build for the iOS Simulator):** upgrade, send, receive QR, activity, Q-Day switch; keys in the iOS keychain, ML-DSA-65 signs on the device.
- **Web:** a read-only quantum readiness scan of any NEAR account (the front door), the "steal the key, still get nothing" drill, and the full wallet.

Magen upgrades an existing account **in place** in one transaction (DeployContract + new + DeleteKey + AddKey execute-only). After that, every payment needs the account's existing ed25519 key **and** a new ML-DSA-65 key; the wallet contract checks both with `env::ed25519_verify` and `env::ml_dsa_verify`. The **Q-Day switch** adds the ML-DSA-65 key as a native NEAR access key (NEP-645); the post-quantum key can then remove the classical key itself, and NEAR Rocks labels the account "Quantum-safe".

## NEAR technology used
`env::ml_dsa_verify` (protocol 87+) and `env::ed25519_verify` in one contract · native ML-DSA-65 access keys (NEP-645) added from a contract promise · ML-DSA-65-signed transactions · function-call access key restricted to `execute` with a fee allowance · atomic multi-action upgrade transaction on a user's own account · `view_access_key_list` for the readiness scan (mainnet and testnet) · the `testnet` registrar contract for account creation.

## Proof
- Live testnet transactions for every flow: README table and `deployments/` (`surfaces-live.json`, `drill-live.json`, `attacks.json`, `verified-live.json`).
- Tests: 78 automated (14 SDK, 46 local NEAR sandbox, 18 phone) plus live testnet runs; see TESTING.md.
- Film: `videos/magen-near/magen-near-film.mp4` (2:19), share copy `magen-near-film-share.mp4` (720p, 3.9 MB).

## Honest limits
Testnet preview, not audited. Both keys live on one device (protects against broken cryptography, not a stolen unlocked device). Chain Signatures and validator keys stay classical. The drill uses deliberately weakened keys (2^18 seeds) to simulate a quantum attacker; it never claims a real quantum attack. `window.magen` follows wallet-selector's action shape; a full wallet-selector module is future work.

## Prior work
An October 2026 prototype (near-hybrid-pq-wallet) explored dual-signature verification; Magen is a new codebase written Nov 13-14 for NEAR HACKATHON.

**Repository:** github.com/nickthelegend/magen-near (private until Nick makes it public).
**License:** MIT, Copyright (c) 2026 Nivesh Gajengi.

Signing-pass film v13: 1:49, six explicit approvals followed by their FINAL NearValidate receipts. Live app: https://magen-near.vercel.app. Details and all six hashes in README.
