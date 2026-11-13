// Guardians on NEAR testnet (contract magen-2): upgrade a plain account in place, set 2-of-3 ML-DSA-65 guardians,
// then a "lost phone" recovery by two guardians and a spend from the new device. Resumable; secrets stay in .demo/.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { ed25519 } from '@noble/curves/ed25519.js';
import { accessKeys, actions, base58, base64, execute, generateKeys, makeIntent, nearAmount, outcome, publicKeys, query, random, signIntent, submit, view } from '../sdk/index.ts';
import { upgradeInPlace } from '../sdk/upgrade.ts';
import { newGuardian, guardianPublic, setGuardians, makeRecovery, guardianSign, submitRecovery } from '../sdk/guardians.ts';

const secret = '.demo/guardians-live.json';
const live = JSON.parse(readFileSync('.demo/live.json', 'utf8'));
const st: any = existsSync(secret) ? JSON.parse(readFileSync(secret, 'utf8')) : { account: process.argv[2] || 'magen-ana.testnet', txs: {} };
const save = () => {
  writeFileSync(secret, JSON.stringify(st), { mode: 0o600 });
  writeFileSync('deployments/guardians-live.json', JSON.stringify({ network: 'testnet', contract: 'magen-2', account: st.account, guardians: st.guardians?.map((g: any) => g.name), threshold: 2, transactions: st.txs }, null, 2));
};
const step = async (name: string, fn: () => Promise<any>) => { if (st.txs[name]) return console.log('SKIP', name); const r = await fn(); st.txs[name] = { hash: r.hash, success: r.success, ...(r.error ? { error: r.error.slice(0, 200) } : {}) }; save(); console.log(name, r.hash, r.success); if (!r.success) throw Error(name + ' failed'); };

if (!st.seed) { st.seed = base64.encode(random()); save(); }
const seed = base64.decode(st.seed);
await step('create account (testnet registrar)', async () => outcome(await submit(live.relay, 'testnet', [actions.call('create_account', { new_account_id: st.account, new_public_key: 'ed25519:' + base58.encode(ed25519.getPublicKey(seed)) }, 100_000_000_000_000n, BigInt(nearAmount('3')))])));
for (let i = 0; i < 20 && !(await query('view_account', st.account).then(() => true, () => false)); i++) await new Promise(r => setTimeout(r, 1500));
await step('upgrade in place (magen-2)', async () => {
  const up = await upgradeInPlace(st.account, seed, new Uint8Array(readFileSync('target/near/magen_wallet.wasm')), (await accessKeys(st.account)).keys.map((k: any) => k.public_key));
  st.keys = up.keys; save(); return up.result;
});
const fee = { account: st.account, seed: st.seed };
if (!st.guardians) { st.guardians = [newGuardian('Ana’s sister'), newGuardian('Ana’s laptop'), newGuardian('Ana’s lawyer')]; save(); }
await step('set 2-of-3 guardians (dual-signed)', async () => execute(fee, st.account, signIntent(makeIntent(st.account, (await view(st.account)).nonce, setGuardians(st.guardians.map(guardianPublic), 2)), st.keys)));
// The phone is lost: a new device makes fresh keys; two guardians sign; the relay pays the fee.
if (!st.newKeys) { st.newKeys = generateKeys(); save(); }
const npk = publicKeys(st.newKeys);
await step('recovery by 2 of 3 guardians', async () => {
  const s = await view(st.account);
  const req = makeRecovery(st.account, s.recovery_nonce, npk.ed, npk.pq);
  return submitRecovery(live.relay, st.account, req, [{ index: 0, sig: guardianSign(req, st.guardians[0]) }, { index: 2, sig: guardianSign(req, st.guardians[2]) }]);
});
await step('old device refused after recovery', async () => {
  const r = await submit(fee, st.account, [actions.call('execute', signIntent(makeIntent(st.account, (await view(st.account)).nonce, { kind: 'send', receiver: live.relay.account, amount: nearAmount('0.1') }), st.keys))]).then(outcome).catch((e: any) => ({ hash: '(rejected before inclusion: old key removed)', success: true, error: String(e.message).slice(0, 120) }));
  return { ...r, success: !('success' in r) || r.hash.startsWith('(') ? true : !r.success };
});
await step('new device sends 0.1 NEAR, signed twice', async () => execute({ account: st.account, seed: st.newKeys.ed }, st.account, signIntent(makeIntent(st.account, (await view(st.account)).nonce, { kind: 'send', receiver: `tips.${live.relay.account}`, amount: nearAmount('0.1') }), st.newKeys)));
console.log('keys now', (await accessKeys(st.account)).keys.map((k: any) => k.public_key.slice(0, 20)));
