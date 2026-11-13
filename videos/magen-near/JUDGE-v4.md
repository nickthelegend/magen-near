# Independent first-time judge review — film v4

**Score: 7.7/10.** A credible, unusually candid technical demonstration with a strong opening. It makes the two-signature safeguard and the optional change to native quantum-only control understandable. It is less successful as a film for someone who has never used a crypto wallet: the stakes remain abstract, several screen states distract from the intended story, and the final image is more documentation than a memorable product ending. I would take the implementation seriously; the film alone would not put it in the top tier for presentation.

## Review scope

I inspected all eight sequential 1 fps sheets in `versions/v4/review/sheet-01.jpg` through `sheet-08.jpg`, covering the approximately 151.9-second film. I also extracted and inspected original-size **1280×720 share-film** frames at 0, 5, 7, 11, 14, 21, 38, 48, 58, 63, 68, 71, 74, 76, 79, 85, 92, 102, 106, 114, 119, 120, 121, 125, 131, 138, 148 and 151 seconds. This is sampled visual inspection, not continuous playback or a claim to have inspected every encoded frame.

Read `versions/v4/narration.txt`, `render-timing.json`, `media-probe.json`, `audio-probe.txt`, `render-v4.py`, `deployments/verified-live.json` and `deployments/browser-film.json`. The supplied media probe describes the 1920×1080 master. I independently probed the actual share file: H.264/AAC, 1280×720, 151.864 seconds, 4,560,573 bytes. Audio was **measured, not heard**. The supplied master measurement is mean −16.6 dB / peak −2.4 dB; a fresh measurement of the share file is mean −16.6 dB / peak −2.3 dB. Those results do not establish pleasant narration, correct pronunciation, absence of audible clicks, or precise spoken/visual synchronization.

No browser was launched and no transaction was submitted. Proof-file inspection is corroboration of the recorded demonstration, not a new chain audit. Scores below reflect what a first-time judge can understand from the film, with the files used to distinguish an editorial weakness from a missing implementation.

## What works

- **The first 15 seconds pass.** The opening makes `1 NEAR`, both signature checks, and the classical/quantum schemes visible. By roughly 6–7 seconds the green confirmation says both signatures were verified. The next attempt visibly selects the forged quantum half and uses `0.001 NEAR`; by roughly 13–14 seconds the red rejection explains that the funds stayed in the wallet. This is a concrete success/failure comparison, not just a promise. The different amounts do not invalidate the test, although a brief “invalid test” label would make the second amount change easier to parse.
- **The lock has useful evidence.** Around 61–69 seconds, the UI states that no access keys remain. Around 70–77 seconds the read-only receipt shows the created film account, `FINAL`, and `DeployContract · FunctionCall(new) · DeleteKey`. That is a much stronger explanation of setup-key removal than a status badge alone.
- **The control caveat is clear.** Around 94–112 seconds, the close crop and narration explicitly say the native full-access key can operate alone and can change the contract. “This leaves strict two-key control” is readable at share resolution. The switch is presented as a deliberate change of authority, not an invisible security upgrade.
- **Native proof is legible.** Around 112–123 seconds, the RPC response shows the film account, `FullAccess`, and the `ml-dsa-65-hash:` key. Around 123–133 seconds, the read-only receipt check reports `ml-dsa-65`. The narration honestly explains the explorer automation block. I do not count the missing explorer screenshot as a material defect: direct RPC proof is appropriate here, and the actual scheme and permission can be read.
- **The ending gives a real next step.** The URL and source-download control are readable. Testnet, unaudited status, no recovery service, and the distinction between account authorization and consensus are disclosed in useful language.

The proof files corroborate the successful 1 NEAR transfer, rejected forged quantum signature, browser creation and deploy/lock, dual-authorized migration, and native-key transfer. The browser-created account is `shield.magen-film-mwf2kq5t.testnet`; the native proof and native transaction use that same account. The native transaction is recorded as signed with `ml-dsa-65`.

## Material defects and practical fixes

| Priority | Where | What the newcomer sees / why it matters | Fix |
|---|---|---|---|
| High | About 47–49s | The new-wallet form initially carries the previous red “Blocked on chain” and “Rejected on NEAR” banners. At the exact moment the film says “Create an account,” the screen appears to report failure. The earlier rejection is valid, but this is the wrong context for it. | Dismiss stale status before recording the form, or start the existing creation footage after the stale banners clear. A clean form is enough; no creation transaction needs to be repeated. |
| Medium | About 47–61s | The film says an encrypted backup downloads before deployment, but the sampled sequence does not visibly show a browser download, saved filename, or other download confirmation. The form spends most of its time on “Creating your protected testnet gas account” and deployment status. A key responsibility is explained but not demonstrated visually. | Add a clear, factual backup-saved confirmation using the existing captured download evidence, if available. Otherwise keep the claim as narration but avoid treating the film as visual proof of that step. |
| Medium | About 61–94s and 94–123s | The creation and native proof do use the same film account, but the connecting Q-Day crop excludes the account address. Everyday receiving then shows the earlier `shield.magen-mwf26bd5.testnet` account. A viewer cannot be expected to memorize long account suffixes and infer which cuts belong together. | Keep a short account identifier visible during creation, lock receipt, and migration, and label the everyday insert as the existing demo wallet. A compact “same account” transition with the matching suffix is sufficient; use existing footage/read-only views. |
| Medium | About 15–47s | The long-term-holder motivation is understandable, but there is no concrete person or consequence. Most of the explanation sits over the dashboard/security panel. “80/100 quantum readiness” also looks like a measured safety rating until the small-print checklist explanation appears later. For a non-crypto judge, the problem remains primarily a cryptography problem. | Use one plain example of the intended user and consequence, then connect it to the demonstrated safeguard. During that explanation, favor a simple two-check visual or the transfer result over the unexplained readiness number. Do not add more technical terminology. |
| Medium | About 133–152s | The source/URL is useful, but the product headline is clipped at the top. The final held image is dominated by build information and caveats; the closing words “Two signatures. One shield. Magen.” have no matching visible brand conclusion. | Reframe the existing about view so the product name/headline and URL fit, or finish on a short Magen/URL end frame after the disclosures have had time to read. Keep the disclosures, but give the final spoken line a visible destination. |

## Legibility and pacing

The essential opening result, native-control warning, RPC permission/key type, and native receipt scheme are readable at 720p. This is not a film with universally illegible evidence. Some aggressive crops cut off adjacent headings and sentence ends: the opening right column, the receive heading at roughly 83–87 seconds, and the about headline at the end. Preserve the focused evidence, but leave a little more margin so the application does not look accidentally cut off.

The 17-second lock section and 21-second native-proof section provide enough reading time. The cost is a noticeably static middle and tail. The everyday section does show saving a contact, receiving, and receipt inspection, but the selected activity viewport spends a substantial part of its time on rejected security-test rows. That makes ordinary use feel like another test report. A shorter hold on the rejection list and a clearer hold on the confirmed receipt would support the narration better.

Individual extracted frames at 74 and 120 seconds also show transiently damaged/overlapping small text compared with nearby clean frames. I do not infer a sustained readability failure from two samples, but these are worth checking in playback before delivery. The primary permission and scheme are clear in adjacent frames.

## Judge assessment

| Dimension | Score |
|---|---:|
| Opening and demonstrated contrast | 8.5/10 |
| Human purpose for an unfamiliar viewer | 6.5/10 |
| Demonstration and evidence clarity | 8.5/10 |
| Visual framing and pacing | 7.0/10 |
| Honest explanation and useful next step | 8.0/10 |

The main opportunity is editorial, not another live transaction: remove the contradictory form banners, make account continuity effortless, and land the final product identity. The existing footage and read-only evidence already support a convincing technical story.
