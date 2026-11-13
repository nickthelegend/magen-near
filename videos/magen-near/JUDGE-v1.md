# Independent judge review — Magen film v1

**Score: 7/10.** This is a credible working hackathon demonstration with a clear differentiator. It is not yet a 9/10 film for a non-crypto judge. The missing points are mainly proof legibility, pacing, and contradictory status language after migration, rather than a lack of working transactions.

## Evidence and limits

- Reviewed **all eight** `versions/v1/review/sheet-01.jpg` through `sheet-08.jpg`, sequentially, covering the complete approximately 155.7-second film at one sampled frame per second. These are real browser images, not reconstructed UI.
- Extracted and inspected full-size 1280×720 share-film frames at approximately 13s, 124s and 149s. Also inspected the 124s frame scaled to 390×220 to approximate a phone-width landscape video embedded in a portrait feed. This is a legibility check, not a physical-device playback test.
- Read `STORYBOARD.md`, `narration.txt`, `timing.json`, `SPEC.md`, the rendering script, `versions/v1/media-probe.json`, `versions/v1/audio-probe.txt`, `deployments/browser-film.json`, and `deployments/verified-live.json`.
- **Audio was measured, not heard.** The supplied probe reports mean −17.1 dB and maximum 0.0 dB. This does not establish pleasant delivery, intelligibility, pronunciation, absence of audible clipping, or exact audiovisual synchronization. The score is provisional on those aspects. The 0 dB peak deserves a listening/true-peak check, not a declaration that the track is clipped.
- One-frame-per-second review cannot assess every cursor action, transient state, dropped frame, or subsecond edit. The local verification report corroborates the transactions and key state, but this review did not independently requery NEAR, audit the contracts, or perform transactions.

## What earns the seven

The first 15 seconds contain a real 1 NEAR send, a confirmation state, a second attempt, and an on-chain rejection. This is a strong choice: useful behavior precedes the explanation. The local verification report has matching successful and failed transaction hashes for those browser actions.

The film has a coherent arc: demonstrate protection, explain the threat, create and lock an account, show basic wallet use, deliberately change its authority, then prove a native-key transaction. The interface looks calm and usable. The fresh-account flow and keyless lock give the project more substance than an isolated signature demo.

The narration makes unusually useful disclosures. It says sufficiently powerful quantum computers do not exist today, identifies testnet and unaudited preview status, limits the claim to account authorization rather than consensus, and explicitly says that native full-access migration permits quantum-only control and contract changes. It also candidly explains that the explorer blocked the automated browser. Replacing the blocked explorer with direct RPC-derived evidence is acceptable; a bot wall is not a reason to fake an explorer page.

`verified-live.json` supports successful browser send, failed forged quantum signature, successful dual-authorized migration, and a final native-signed transfer. Its final state records the filmed account's `ml-dsa-65-hash:` key with `FullAccess`; the older hybrid account has no access keys. These support the technical story within the limits above.

## Material weaknesses

1. **The central proof is too small for sharing.** The opening rejection is readable at 1280×720 if the viewer deliberately reads it, but its explanatory copy is small. At roughly 121–126s, the native public key is a narrow row at the very bottom of the frame. At 390px video width, that key, account-status copy, and receipt detail are effectively unreadable. The viewer receives the narration's conclusion without being able to inspect the decisive evidence.

2. **The native-key shot is a product rendering of RPC data, not an independently legible raw response.** The sampled 124s frame shows “What NEAR sees,” “1 access keys,” and the `ml-dsa-65-hash:` public key. It does not visibly establish the RPC endpoint, query account, block, nonce, or `FullAccess` permission. The backing JSON report establishes more than the film itself shows. Saying “actual access key response” is directionally defensible if this panel renders a live RPC result, but the viewer sees only a selected field and must trust the app. Show the actual relevant response fields if that is the spoken proof claim.

3. **Post-migration status is contradictory.** At 124s, the page displays “Two signatures required — Active” alongside a native post-quantum key being enabled. The narration correctly explains that the native full-access key can act alone, and the Q-Day card discloses that this leaves strict two-key control. A non-crypto judge should not have to reconcile those statements. The contract route may still verify two signatures, but account-wide two-signature enforcement has ended.

4. **The opening attack is described imprecisely.** The narration says “Now remove the quantum half.” The filmed browser evidence is named “Browser forged quantum rejection,” and its matching verified receipt fails with “quantum half missing or invalid” at the invalid-signature branch. The verification report separately contains a true missing-half test with a different transaction. Describe the filmed attack as an invalid/forged quantum signature, or film the actual missing-half attempt. The first send is 1 NEAR, whereas the rejected attempt is 0.001 NEAR; the narration should not imply a literal repeat of the same payment.

5. **Large static holds slow the middle.** Roughly 21–46s and 64–88s repeatedly show essentially the same Protection page. The narration has meaningful content, but the film offers little visual progression while it explains host functions, message fields, replay and expiry. Small text cannot carry that information for a mobile viewer. Creation and migration are stronger because a visible state actually changes.

6. **The ending's `100/100` “quantum readiness” claim is stronger than the caveats.** The large score dominates the closing image while the narration says preview, unaudited, and authorization-only. No visible scoring method supports it. A categorical native-key status would be more credible. The lingering “Two signatures. One shield.” slogan also needs care after quantum-only authority has just been demonstrated; the film should leave the viewer with the current control model.

7. **The activity segment does not visually earn all of its narration.** Around 95–101s it shows one “Account Created & Locked” row while the narration discusses receipts and rejected attempts staying visible. Rejected attempts were shown earlier on the other account, but they are not demonstrated in this activity list. Show the actual relevant history, or narrow the spoken claim to what the current shot establishes.

## Exact changes needed for an honest nine

1. **Make the proof readable before polishing anything else.** Capture the real app at a larger browser zoom or use truthful crops of the actual recording. Give the opening confirmation and rejection their own tight, readable holds. Make the relevant action/status take most of the video width. For phone-width review, the viewer should be able to read “Confirmed,” “Blocked on chain,” and the reason without pinching. No overlay or subtitle is required.

2. **Correct the opening line to match the recorded test:** “Now try a forged quantum signature. NEAR rejects this transfer.” Keep the visible amount distinct. If “remove the quantum half” is retained, record and show the actual missing-half branch instead.

3. **Show one compact, genuine key-state proof sequence:** hybrid account has zero access keys → both signatures authorize migration → RPC query for the same account shows the `ml-dsa-65-hash:` key and `FullAccess` → native-only transaction succeeds. Use a real browser view with readable account ID and relevant RPC response fields. Hold the key/permission response for roughly 4–5 seconds. A whole long key string need not be memorized, but the algorithm prefix, authority, and account association must be visible. Keep the candid explorer-block explanation.

4. **Correct the real app's post-migration status before recapturing.** Replace account-wide “Two signatures required — Active” with wording that distinguishes dual-signature contract operations from native PQ full-access authority. Replace `100/100` readiness with a factual status such as “Native PQ key enabled.” The existing spoken explanation of contract-changing authority should remain.

5. **Remove approximately 20–30 seconds of repeated Protection holds, or replace them with readable real evidence.** Show the actual zero-key response, a receipt's dual-verification log, and a rejected/replay receipt while those claims are spoken. Preserve natural pauses at outcomes; shorten narration that enumerates technical fields over an unchanged screen. The target is not an arbitrary short runtime: each sustained shot should either change state or reveal evidence the judge can read.

6. **Match activity claims to actual history** and end on the native-key proof or a factual current-state screen with the testnet/preview qualifier visible in the real UI. Retain the spoken unaudited and consensus-scope disclosures. Listen to the exported share file end to end and verify intelligibility, pronunciation, peaks and cut timing before giving a final audiovisual score.

A revised cut that passes those checks could earn nine: it already has the working behaviors and honest technical scope. More cinematic decoration would not solve the current weaknesses; readable evidence and consistent authority language would.
