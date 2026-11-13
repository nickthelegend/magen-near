# Magen — NEAR HACKATHON

Project: Magen (מגן, Hebrew for shield)
Track: Quantum-resistant blockchain / post-quantum account security
Built: November 13–14, 2026, fresh codebase.

Your NEAR account, safe from quantum computers. Magen is a real testnet wallet that requires a classical ed25519 signature AND a post-quantum ML-DSA-65 signature before its contract authorizes any send or contract call. Both sign the same domain-bound, expiring, nonce-protected intent. The deploy key is deleted atomically with initialization. A forged half or replay is rejected on chain and shown in activity.

A Q-Day switch adds the owner's PQ key as a native ML-DSA-65 full-access key, keeping the account while explicitly changing its control model to PQ-only. The app shows the resulting access-key hash and links the explorer. Native PQ signing can be demonstrated after migration.

Browser-generated independent seeds, AES-GCM encrypted password backup, real balances, send/receive, contacts, contract calls and receipt-linked activity. Native protocol support and in-contract verification are both used.

Scope: NEAR testnet; unaudited preview. No consensus-level quantum-safety claim. Guardians/recovery deferred. A native full-access key can bypass the contract and change it. Local activity journal is not a complete chain indexer.

Prior work: An October 2026 prototype (near-hybrid-pq-wallet) explored dual-signature verification; Magen is a new codebase written Nov 13-14 for NEAR HACKATHON.

Live demo: https://magen-near.vercel.app
Contract: shield.magen-mwf26bd5.testnet (hybrid, keyless)
Native migration proof: shield.magen-film-mwf2kq5t.testnet
Film: magen-near-film-share.mp4 (2:35, H264/AAC, 720p)
Project repository: session owner must push and supply the public repository URL; no push performed by this agent.
Testing: 10 SDK tests, 13 sandbox cases, 18 viewport/route checks; 17 final live receipts verified over RPC.
Explorer rendering caveat: NearBlocks blocks automated capture; direct protocol RPC proof is shown honestly in the film.
License: MIT. Copyright (c) 2026 Nivesh Gajengi.
