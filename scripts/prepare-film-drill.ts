// Prepares a fresh drill for filming (accounts only; the attack runs on camera in the app).
// The funder is a top-level testnet account made through the `testnet` registrar, paid by our relay.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { actions, base58, base64, nearAmount, outcome, random, submit, signerPublic } from '../sdk/index.ts';
import { prepareDrill } from '../sdk/drillflow.ts';
const out = process.argv[3] || '.demo/drill-film.json';
if (existsSync(out)) { console.log('exists', out); process.exit(0); }
const live = JSON.parse(readFileSync('.demo/live.json', 'utf8'));
const funder = { account: `${process.argv[2] || 'qday-drill'}.testnet`, seed: base64.encode(random()) };
const r = outcome(await submit(live.relay, 'testnet', [actions.call('create_account', { new_account_id: funder.account, new_public_key: 'ed25519:' + base58.encode(signerPublic(funder)) }, 100_000_000_000_000n, BigInt(nearAmount('6.4')))]));
if (!r.success) throw Error(r.error);
for (let i = 0; i < 20; i++) { try { await (await import('../sdk/index.ts')).query('view_account', funder.account); break; } catch { await new Promise(x => setTimeout(x, 1500)); } }
const st = await prepareDrill(funder, new Uint8Array(readFileSync('target/near/magen_wallet.wasm')), (s, d) => console.log('·', s, d ?? ''));
writeFileSync(out, JSON.stringify(st), { mode: 0o600 });
console.log('READY', st.plain.account, st.magen.account, st.attacker.account);
