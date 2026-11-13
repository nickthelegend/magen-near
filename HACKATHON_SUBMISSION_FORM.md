# Magen — NEAR HACKATHON

Project: Magen (מגן, Hebrew for shield)
Track: Quantum-resistant blockchain / post-quantum account security
Built: November 13–14, 2026, fresh codebase.

Your NEAR account, safe from quantum computers. Magen is a real testnet wallet that requires a classical ed25519 signature AND a post-quantum ML-DSA-65 signature before its contract authorizes any send or contract call. Both sign the same domain-bound, expiring, nonce-protected intent. The deploy key is deleted atomically with initialization. A forged half or replay is rejected on chain and shown in activity.

A Q-Day switch adds the owner's PQ key as a native ML-DSA-65 full-access key, keeping the account while explicitly changing its control model to PQ-only. The app shows the resulting access-key hash and links the explorer. Native PQ signing can be demonstrated after migration.

Browser-generated independent seeds, AES-GCM encrypted password backup, real balances, send/receive, contacts, contract calls and receipt-linked activity. Native protocol support and in-contract verification are both used.

Scope: NEAR testnet; unaudited preview. No consensus-level quantum-safety claim. Guardians/recovery deferred. A native full-access key can bypass the contract and change it. Local activity journal is not a complete chain indexer.

Prior work: An October 2026 prototype (near-hybrid-pq-wallet) explored dual-signature verification; Magen is a new codebase written Nov 13-14 for NEAR HACKATHON.

Live URL and film: appended after verified deployment/capture.
License: MIT. Copyright (c) 2026 Nivesh Gajengi.
