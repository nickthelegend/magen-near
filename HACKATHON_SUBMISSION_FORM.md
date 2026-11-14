# Magen · NEAR HACKATHON 2026 submission

**Project:** Magen (מגן, Hebrew for "shield")
**One line:** Keep your NEAR account. Add a second lock a quantum computer can't pick.
**Tracks:** security (primary), open.
**Built:** Nov 13–14 2026, fresh codebase (see Prior work).

## What it is
A quantum-safe NEAR wallet on three surfaces that share one SDK:
- **Chrome extension (MV3):** popup wallet plus a `window.magen` dApp provider; every dApp request opens an approval window that shows "Signed twice: classical + quantum-safe".
- **iPhone app (Expo, Release build for the iOS Simulator):** 12-word wallet with addresses on every chain, dual-signed send, Ref swap, Omni bridge (chain list read live from Omni: Solana, Base, Ethereum, Arbitrum, Polygon, Avalanche, BNB out; Bitcoin and Zcash in), Send on Ethereum through quantum-gated NEAR Chain Signatures, "Test my quantum lock", private send, 2-of-3 ML-DSA-65 guardians, Q-Day switch, activity, Face ID; keys in the iOS keychain, ML-DSA-65 signs on the device.
- **Web:** a read-only quantum readiness scan of any NEAR account (the front door), the "steal the key, still get nothing" drill, and the full wallet.

Magen upgrades an existing account **in place** in one transaction (DeployContract + new + DeleteKey + AddKey execute-only). After that, every payment needs the account's existing ed25519 key **and** a new ML-DSA-65 key; the wallet contract checks both with `env::ed25519_verify` and `env::ml_dsa_verify`. The **Q-Day switch** adds the ML-DSA-65 key as a native NEAR access key (NEP-645); the post-quantum key can then remove the classical key itself, and NEAR Rocks labels the account "Quantum-safe".

## NEAR technology used
`env::ml_dsa_verify` (protocol 87+) and `env::ed25519_verify` in one contract · native ML-DSA-65 access keys (NEP-645) added from a contract promise · ML-DSA-65-signed transactions · function-call access key restricted to `execute` with a fee allowance · atomic multi-action upgrade transaction on a user's own account · `view_access_key_list` for the readiness scan (mainnet and testnet) · the `testnet` registrar contract for account creation.

## Proof
- Live testnet transactions for every flow: README table and `deployments/` (`surfaces-live.json`, `drill-live.json`, `attacks.json`, `verified-live.json`).
- Tests: 78 automated (14 SDK, 46 local NEAR sandbox, 18 phone) plus live testnet runs; see TESTING.md.
- Film (v17, iPhone only, every action live on testnet): `videos/magen-near/magen-near-film.mp4` (7:09), 720p `magen-near-film-share.mp4`, 1.5x cut `magen-near-film-1.5x.mp4` (4:46). Hashes: `deployments/film-v17-live.json`.
- One-command live check for judges: `node scripts/judge-verify.mjs` (17 checks, see JUDGES.md).

## Honest limits
Testnet preview, not audited. Both keys live on one device (protects against broken cryptography, not a stolen unlocked device). Chain Signatures and validator keys stay classical. The drill uses deliberately weakened keys (2^18 seeds) to simulate a quantum attacker; it never claims a real quantum attack. `window.magen` follows wallet-selector's action shape; a full wallet-selector module is future work.

## Prior work
An October 2026 prototype (near-hybrid-pq-wallet) explored dual-signature verification; Magen is a new codebase written Nov 13-14 for NEAR HACKATHON.

**Repository:** https://github.com/nickthelegend/magen-near (public).
**License:** MIT, Copyright (c) 2026 Nivesh Gajengi.

Lead: Nivesh Gajengi, who also leads Kotoba (https://github.com/nickthelegend/kotoba-near), an independent project (Q-015).
