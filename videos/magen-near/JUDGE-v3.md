# Independent film review — v3

**Score: 8.6/10.** Strong, credible hackathon demonstration; I would advance it for technical judging. I would not call this a 9/10 film for an unfamiliar, non-crypto judge yet. The proof is substantially stronger than the presentation's pacing and immediate accessibility.

## Review scope

Reviewed the actual `versions/v3/magen-near-film-share.mp4` through all eight sequential contact sheets, sampled at approximately **1 frame per second**, plus full-resolution share-film frames at 4, 7, 12, 13, 14, 62, 68, 77, 119 and 126 seconds. This is a sampled visual review, **not inspection of every encoded frame** or continuous real-time playback. Read `narration.txt`, `render-v3.py`, `timing.json`, `deployments/verified-live.json` and `deployments/browser-film.json`. Audio was **measured, not heard**: the supplied probe reports mean −16.6 dB and maximum −2.3 dB; I cannot assess pronunciation, perceived naturalness, clicks or exact spoken/visual synchronization from those measurements.

No transactions were sent and no browser actions were performed for this review. Local evidence was cross-checked, not freshly reverified against RPC.

## What works

- The opening delivers the actual product before the explanation: a 1 NEAR dual-signature success is visibly confirmed around 7 seconds, then a deliberately forged quantum half is visibly rejected around 13–14 seconds. It passes the first-15-seconds success/rejection test. The rejection text explicitly says no transfer was authorized and funds stayed in the wallet.
- The story follows a sensible arc: demonstrate protection, explain the future threat without claiming today's quantum computers can break it, create an account, remove setup access, show receipts, deliberately change the control model, then show native proof.
- The creation/lock sequence now stays with `shield.magen-film-mwf2kq5t.testnet`. It no longer substitutes the other demo account's RPC empty-key list immediately after creation. The footage shows deployment/lock completion and the newly created account's protection state continuously. The literal empty-key RPC response earlier in the film is for the earlier demo account; that distinction is consistent with the sequence.
- The Q-Day closeup is unusually candid: it states the key becomes full access, works with the quantum signature alone, can change the contract, and leaves strict two-key control. This avoids selling migration as an unqualified security score improvement. The misleading legacy post-migration status/100 panel is absent from the inspected migration segment.
- Native proof is readable in the share version. Around 119 seconds, the correct account, `FullAccess` permission and `ml-dsa-65-hash` key are visible. Around 126 seconds, the existing receipt ID and `Signing scheme: ml-dsa-65` confirmation are visible. Narration correctly calls this a recorded transfer and a read-only receipt check. The verified evidence identifies the same native transfer as successful with an ML-DSA-65 signing key.
- Scope and limitations are clear: NEAR testnet, fresh hackathon build, no audit, authorization rather than consensus protection, and a local receipt journal rather than complete history. These admissions strengthen credibility.

## Material remaining issues

1. **The middle still feels stretched.** Around 48–64 seconds, the account form spends substantial time waiting for creation; around 70–82 seconds, the lower protection/footer crop barely changes. The narration has relevant content, but the visual beat does not advance with it. Approximately 15–20 seconds could be removed or made more informative without repeating any live action. This is the largest gap to a 9 for a general judge.
2. **The film explains cryptography more clearly than the user's immediate reason to adopt it.** A non-crypto judge learns how the shield works and why quantum threats matter, but gets little concrete present-day user context or comparative benefit. “NEAR now gives developers…” and host-function terminology consume time before the workflow. A single concrete user/stakes sentence would improve recall.
3. **Some aggressive crops trade polish for readability.** The opening cuts off the right-hand explanation; the 77-second lower-state crop cuts a button and the disclosure line; the receipt view cuts the right-hand control/label. Core proof remains readable, so this is not a validity problem, but it looks like a magnified browser capture rather than a fully composed film.
4. **The closing image is held for a long time without a memorable next step.** The balance card communicates a real running wallet, but it does not visually carry the closing claim about inspectable source and receipts. A concise final source/demo destination would make the ending more useful to a judge.

## Verdict

The v2 trust issues called out in the supplied brief are materially addressed. I found no new material contradiction between the sampled film, narration and local receipt evidence. This is a persuasive demonstration of a real implementation, with enough honest limits to trust its claims. The remaining gap is chiefly editorial: shorten static holds, strengthen the human reason to care, and compose the final proof/closing frames more deliberately. **8.6/10 is my independent score; the desired 9 does not change it.**
