# Independent judge review — Magen film v2

**Overall score: 8.2/10.** This is a substantial improvement over v1's 7/10. It now demonstrates credible working behavior and makes the decisive native-key proof readable on a desktop. It still falls below an honest nine for a non-crypto judge because the account continuity, demonstration wording, pacing and small-screen proof need another pass. This score is provisional on audio quality, which I did not hear.

## Review scope

- Inspected **all eight sequential frame sheets**, `versions/v2/review/sheet-01.jpg` through `sheet-08.jpg`, covering the complete 155.706-second film at one sampled frame per second. This is **all supplied 1 fps samples, not every encoded frame**; it does not establish smooth playback, every transient state or subsecond synchronization.
- Extracted and inspected actual 1280×720 share-film frames at 12, 14, 84, 113, 125, 135 and 148 seconds, plus the native-key proof at 390×220. These are truthful film frame extractions, not reconstructed UI. The 390px check approximates a small embedded landscape video, not a physical-device test.
- Read `narration.txt`, `timing.json`, `JUDGE-v1.md`, `render-v2.py`, `versions/v2/audio-probe.txt`, `deployments/verified-live.json` and `deployments/browser-film.json`. Probed the share file: H.264, 1280×720, 30 fps, AAC mono, 155.706 seconds. The supplied audio probe concerns the 1920×1080 master.
- **Audio was measured, not heard.** The supplied master probe reports mean −17.1 dB and maximum 0.0 dB. That does not prove intelligibility, natural delivery, pronunciation, absence of audible distortion or exact audiovisual timing. A 0 dB measured peak is reason to listen and measure true peak, not sufficient evidence to declare audible clipping.
- I did not independently query NEAR, audit contracts, launch a browser, or execute any transaction. Local verification evidence corroborates the filmed results within that limit.

## What improved and earns the score

The opening has a readable, genuine success/rejection sequence. At 14s, “Blocked on chain,” the invalid quantum-half reason and “Rejected on NEAR” are readily readable at full size. The narration now says “forge the quantum half,” which matches the filmed forged-signature receipt. The successful 1 NEAR send and rejected 0.001 NEAR attempt remain distinct on screen.

The RPC closeups are materially better. At 125s the actual filmed view visibly associates the endpoint and `view_access_key_list` query with `shield.magen-film-mwf2kq5t.testnet`, then shows a block hash, block height, nonce, `FullAccess` permission and `ml-dsa-65-hash:` public key. The film now provides much more than a selected algorithm label. Explaining the public explorer's bot wall and using direct RPC-derived evidence is honest and acceptable.

At 135s, the filmed receipt verification reports “Signing scheme: ml-dsa-65” and exposes the native transaction hash. `verified-live.json` corroborates that exact transaction, `8EGTshvxxVGKrXgcTftXjWZ4sGVKr8ukDBwnNtiQgu8F`, as successful, final and signed by the filmed shield account with `ml-dsa-65`. This is convincing evidence of a native PQ-signed transaction, rather than only proof that a PQ key exists.

The activity section now shows real rejected attack receipts, so it earns its narration. The closing crop replaces the dominant readiness score with a large, factual “Native PQ enabled” balance card. The spoken disclosures remain unusually good: hypothetical future quantum capability, testnet, fresh hackathon build, unaudited preview, authorization rather than network consensus, and the fact that a native full-access key can act alone and change the contract.

## Material issues keeping it below nine

1. **The zero-key proof breaks the account continuity.** The film creates `shield.magen-film-mwf2kq5t.testnet`, then the zero-key RPC closeup around 79–89s visibly queries `shield.magen-mwf26bd5.testnet`. The migration and native-key proof return to the newly created film account. Both accounts may be legitimate, and the older account's keyless state is corroborated locally, but this does not visually demonstrate the claimed before/after state of the same created account. A judge should not need to notice and reconcile long, different IDs while the narration explains deployment and lock.

2. **“Now sign with that key alone” describes more than the new shot shows.** The visible action is verification of an existing receipt; it is explicitly titled “Verified Existing Receipt” and provides a transaction-hash input. The receipt and local report support that the transaction was native-signed, but the shot does not show signing it now. This is easy to correct without another transaction.

3. **The middle is still too static for this length.** The runtime remains about 2m36s. Roughly 64–78s holds the same Protection page while narration lists deployment, signatures and message fields; roughly 79–89s holds the zero-key JSON. Earlier Protection material also repeats around 23–46s. New proof is welcome, but ten seconds on essentially four JSON fields and repeated controls slows the story. A non-crypto judge gets a strong first result, then waits too long for the next meaningful state change.

4. **Small-screen proof is still difficult to inspect.** The full-size 125s RPC shot is readable. At 390px video width, source/account association and the key/permission fields become tiny, approximately 5–7px text. The improved closeup is an effective desktop proof shot, but it does not yet satisfy the shareability goal on a small embedded player. The native receipt's signing-scheme subline is likewise much smaller than its success heading. The viewer should be able to read the decisive algorithm and authority without pinching.

5. **Old post-migration labels survive in the actual migration footage.** The retakes and closing image improve the authority wording, but the reused migration sequence around 114–120s still carries the old Protection panel and its `100/100` badge. Several crops leave only “Active / Verified / Enabled” and the score at the left edge while cutting away their labels. The narration explains the changed control model accurately; the frame should communicate that model just as clearly. The final “Two signatures. One shield” slogan also lands after native-only authority has been demonstrated, making the product's two modes less clear than they could be.

## Exact next changes for an honest nine

1. **Repair the same-account proof chain.** Use an existing genuine pre-migration zero-key response for `shield.magen-film-mwf2kq5t.testnet`, with its account and block visible, if one was captured. Do not relabel an old account's response. If no such capture exists, explicitly identify the zero-key shot as the earlier hybrid demonstration account and change the narration/sequence so it is not presented as the newly created account's state. This can be resolved honestly without another live transaction.

2. **Change the native-proof line to match the read-only action:** “This transaction was signed by that key alone. NEAR verified it directly.” Retain the actual transaction hash and `ml-dsa-65` signing-scheme result on screen. No repeat transaction is needed.

3. **Tighten the middle by approximately 20 seconds.** Reduce repeated Protection holds, keep the zero-key response to around 4–5 seconds, and shorten the list of signed message fields unless the corresponding evidence is visibly shown. Preserve the opening result, migration decision, readable native-key proof and final signing-scheme receipt. A shorter cut should result from removing repetition, not rushing the evidence.

4. **Make three decisive proof lines readable at 390px player width:** the rejection reason, `FullAccess` plus `ml-dsa-65-hash`, and the native receipt's `ml-dsa-65` signing scheme. Use tighter crops of genuine footage or a genuine larger-zoom read-only capture. Establish account/source context first, then crop to the meaningful fields. A full block hash and full public key do not need to occupy the same shot as the plain-language conclusion.

5. **Remove the remaining legacy authority/status footage from the migration outcome.** Recut from the genuine recorded confirmation to the corrected native-control retake. Keep a visible factual “Native PQ enabled” state; omit the ungrounded `100/100` score and unlabeled status slivers. Close with wording that recognizes the demonstrated mode, for example “Two-key protection. A native quantum path. Magen.”

6. **Listen to the final share export end to end**, check pronunciation and intelligibility against the final shots, and measure true peak on that export. The current measured-only review cannot award audio quality points that have not been observed.

The remaining work is mostly truthful continuity and editing. Additional live transactions or visual decoration are not necessary to address these findings.
