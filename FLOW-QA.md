# Flow QA

Fresh scaffold had no UI to capture before implementation. Private leader captures: orchestration/shots/magen/leader-refs (Phantom, Rabby, Zerion; Rainbow navigation aborted, not claimed captured).

App routes: /#home, /#send, /#receive, /#activity, /#security, /#contacts, /#create, /#unlock, /#call.

Screenshots and overflow results pending capture under the shared Chrome lock. Full evidence: deployments/ui-qa.json. Screenshots outside the repository at ../../orchestration/shots/magen/.

Read-only mode is explicit. Signing requires encrypted-backup unlock. Creation generates both seeds locally, downloads an encrypted backup before deployment and deletes the deploy key atomically with initialization. Native migration explicitly discloses single PQ full-access control.

Initial capture complete: 9 routes × 2 widths = 18 screenshots; 0 horizontal overflow; 0 runtime errors. See deployments/ui-qa.json. Paths: ../../orchestration/shots/magen/{home,send,receive,activity,security,contacts,create,unlock,call}-{1440,375}.png. Native key screenshot: native-rpc-key-1440.png. NearBlocks screenshot shows an external bot-verification page; no explorer-key rendering is claimed.

Confirmation capture after contrast correction: all 18 screenshots re-captured, same routes and viewport sizes; zero overflow and runtime errors again. Browser film also exercised actual unlock, successful send, forged-half rejection, account creation and native migration. Creation and migration occurred once, not mocked.
