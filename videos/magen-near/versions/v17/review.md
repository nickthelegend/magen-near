# Magen film v17: self-review

Final: `videos/magen-near/magen-near-film.mp4` (1920x1080, 30 fps, 7:09), `-share.mp4` (1280x720), `-1.5x.mp4` (4:46).
v16 is kept as `versions/v16-final.mp4`.

Order: landing (quantum risk to every chain, "Four chains, one weakness", iPhone and Chrome panels) → iOS install →
new wallet tovmagen.testnet (12 words stay hidden) → Home → receive → send 0.5 NEAR + receiver account on NEAR Rocks →
swap on Ref + received card + explorer + USDT on Home → bridge picker built from Omni's live registry → NEAR → Base
Sepolia (Basescan shows the wNEAR at the wallet's Chain Signatures address) → NEAR → Solana devnet (receiving account
holds the wNEAR) → Send on Ethereum through NEAR MPC gated by both locks → Etherscan tx + receiver → "Test my quantum
lock": one-signature request refused on NEAR, explorer shows the failure → private send + one-time account holding
0.1 NEAR → 2-of-3 guardians → Q-Day switch, NEAR lists the native ML-DSA-65 full-access key → activity → lock + Face ID
→ card. Every hash is in `deployments/film-v17-live.json`.

Seed check: OCR of all 859 half-second frames; no frame has 6+ numbered BIP-39 words. The three frame runs with 4-5
are the numbered call lists on the swap and bridge approval sheets (checked by eye).

Honest flaws: no tap marks (simctl does not record touches); waits for Omni and Sepolia are hard-cut; Home beats at
the start use the orb avatar only from the bridge take on; busy buttons ("Waiting for Sepolia…") show while chains
confirm; the Solana token page holds for about 3 s; 7:09 is long (the 1.5x cut is 4:46). Bridge-in from EVM chains is
listed in the picker as coming, not live.
