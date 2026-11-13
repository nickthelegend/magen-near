// Makes an ordinary testnet account (one full-access ed25519 key) as a sub-account of our relay,
// standing in for "an account you already have". Secret goes to .demo/ only; stdout gets the account id.
import { readFileSync, writeFileSync } from 'node:fs';
import { ed25519 } from '@noble/curves/ed25519.js';
import { actions, base58, base64, concat, nearAmount, outcome, random, submit } from '../sdk/index.ts';
const d = JSON.parse(readFileSync('.demo/live.json', 'utf8'));
const name = (process.argv[2] || 'e2e').replace(/[^a-z0-9-]/g, '');
const amount = process.argv[3] || '2.5';
const seed = random(), pub = ed25519.getPublicKey(seed);
// "name.testnet" asks the `testnet` registrar contract (what the faucet uses) to create a top-level account;
// anything else becomes a sub-account of the relay.
const top = name.endsWith('testnet');
const account = top ? `${name.replace(/-?testnet$/, '')}.testnet` : `${name}-${Date.now().toString(36)}.${d.relay.account}`;
const r = top
  ? outcome(await submit(d.relay, 'testnet', [actions.call('create_account', { new_account_id: account, new_public_key: 'ed25519:' + base58.encode(pub) }, 100_000_000_000_000n, BigInt(nearAmount(amount)))]))
  : outcome(await submit(d.relay, account, [actions.create(), actions.transfer(BigInt(nearAmount(amount))), actions.addKey(pub)]));
if (!r.success) throw Error(r.error);
const file = `.demo/plain-${account}.json`;
writeFileSync(file, JSON.stringify({ account, secret: 'ed25519:' + base58.encode(concat(seed, pub)), seed: base64.encode(seed) }), { mode: 0o600 });
console.log(JSON.stringify({ account, file }));
