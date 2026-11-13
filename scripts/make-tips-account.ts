// Creates the demo dApp's tip recipient as a sub-account of our relay (the testnet faucet was rate-limiting).
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { ed25519 } from '@noble/curves/ed25519.js';
import { actions, base64, nearAmount, outcome, query, random, submit } from '../sdk/index.ts';
const live = JSON.parse(readFileSync('.demo/live.json', 'utf8'));
const account = `tips.${live.relay.account}`;
if (await query('view_account', account).then(() => true, () => false)) { console.log('exists', account); process.exit(0); }
const seed = random();
writeFileSync('.demo/tips.json', JSON.stringify({ account, seed: base64.encode(seed) }), { mode: 0o600 });
const r = outcome(await submit(live.relay, account, [actions.create(), actions.transfer(BigInt(nearAmount('0.05'))), actions.addKey(ed25519.getPublicKey(seed))]));
console.log(r.success ? 'created' : 'failed', account, r.hash);
