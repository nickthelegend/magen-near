// Sandbox tests for contract magen-2: guardians (2-of-3 ML-DSA-65) rotate both locks; attacks are refused.
// Real transactions on a local neard 2.14 sandbox (protocol 88). Nothing is mocked.
import { Worker } from 'near-workspaces';
import { readFileSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { ed25519 } from '@noble/curves/ed25519.js';
import { useRpc, submit, actions, outcome, query, view, accessKeys, makeIntent, signIntent, execute, nearAmount, base64, base58, generateKeys, publicKeys, random, type Signer } from '../sdk/index.ts';
import { seedFromPrivateKey, upgradeInPlace, edKeyString } from '../sdk/upgrade.ts';
import { newGuardian, guardianPublic, setGuardians, makeRecovery, guardianSign, submitRecovery } from '../sdk/guardians.ts';

const port = 5344;
const worker = await Worker.init({ homeDir: process.cwd() + '/.tools/sandbox-home-g-' + Date.now(), port, rpcAddr: `http://127.0.0.1:${port}`, rm: true } as any);
const results: { name: string; passed: boolean; detail?: string }[] = [];
const pass = (name: string, detail = '') => { results.push({ name, passed: true, detail }); console.log('PASS', name, detail); };
const wasm = new Uint8Array(readFileSync('target/near/magen_wallet_v2.wasm'));
const NEAR = (n: string) => BigInt(nearAmount(n));
try {
  useRpc(`http://127.0.0.1:${port}`);
  const root = worker.rootAccount;
  const rootSigner: Signer = { account: root.accountId, seed: base64.encode(seedFromPrivateKey((await root.getKey())!.toString())) };
  const mk = async (name: string, amount: string) => {
    const seed = random(); const id = `${name}.${root.accountId}`;
    assert(outcome(await submit(rootSigner, id, [actions.create(), actions.transfer(NEAR(amount)), actions.addKey(ed25519.getPublicKey(seed))])).success);
    return { id, seed };
  };
  const owner = await mk('owner', '8');
  const helper = await mk('helper', '2');
  const helperSigner: Signer = { account: helper.id, seed: base64.encode(helper.seed) };
  const keys0 = (await accessKeys(owner.id)).keys.map((k: any) => k.public_key);
  const up = await upgradeInPlace(owner.id, owner.seed, wasm, keys0);
  assert(up.result.success, up.result.error); pass('upgrade in place with magen-2');
  const fee: Signer = { account: owner.id, seed: base64.encode(owner.seed) };
  const s0 = await view(owner.id); assert.equal(s0.version, 'magen-2'); assert.equal(s0.threshold, 0);

  // Recovery without guardians is refused.
  const g = [newGuardian('alice'), newGuardian('bob'), newGuardian('carol')];
  const nk = generateKeys(), npk = publicKeys(nk);
  let req = makeRecovery(owner.id, '0', npk.ed, npk.pq);
  let r = await submitRecovery(helperSigner, owner.id, req, [{ index: 0, sig: guardianSign(req, g[0]) }]);
  assert(!r.success && r.error.includes('no guardians set'), r.error); pass('recovery refused when no guardians are set');

  // Setting guardians needs both owner signatures.
  const act = setGuardians(g.map(guardianPublic), 2);
  const forged = signIntent(makeIntent(owner.id, (await view(owner.id)).nonce, act), up.keys);
  r = await execute(fee, owner.id, { ...forged, pq_sig: '' });
  assert(!r.success && r.error.includes('quantum half missing')); pass('setting guardians with the classical key alone is refused');
  r = await execute(fee, owner.id, signIntent(makeIntent(owner.id, (await view(owner.id)).nonce, act), up.keys));
  assert(r.success, r.error);
  const s1 = await view(owner.id); assert.equal(s1.guardians.length, 3); assert.equal(s1.threshold, 2); pass('owner sets 2-of-3 ML-DSA-65 guardians (dual-signed)');

  // Attacks on recovery.
  req = makeRecovery(owner.id, '0', npk.ed, npk.pq);
  r = await submitRecovery(helperSigner, owner.id, req, [{ index: 0, sig: guardianSign(req, g[0]) }]);
  assert(!r.success && r.error.includes('not enough guardian signatures'), r.error); pass('one guardian alone cannot recover');
  r = await submitRecovery(helperSigner, owner.id, req, [{ index: 0, sig: guardianSign(req, g[0]) }, { index: 0, sig: guardianSign(req, g[0]) }]);
  assert(!r.success && r.error.includes('duplicate guardian signature'), r.error); pass('the same guardian twice is refused');
  const outsider = newGuardian('mallory');
  r = await submitRecovery(helperSigner, owner.id, req, [{ index: 0, sig: guardianSign(req, g[0]) }, { index: 1, sig: guardianSign(req, outsider) }]);
  assert(!r.success && r.error.includes('guardian signature invalid'), r.error); pass('a non-guardian signature is refused');
  const other = makeRecovery(owner.id, '0', ed25519.getPublicKey(random()), npk.pq);
  r = await submitRecovery(helperSigner, owner.id, req, [{ index: 0, sig: guardianSign(req, g[0]) }, { index: 1, sig: guardianSign(other, g[1]) }]);
  assert(!r.success && r.error.includes('guardian signature invalid'), r.error); pass('a signature over different new keys is refused');
  const stale = makeRecovery(owner.id, '0', npk.ed, npk.pq, 1);
  r = await submitRecovery(helperSigner, owner.id, stale, [{ index: 0, sig: guardianSign(stale, g[0]) }, { index: 2, sig: guardianSign(stale, g[2]) }]);
  assert(!r.success && r.error.includes('expired'), r.error); pass('an expired recovery is refused');

  // Valid 2-of-3 recovery rotates both locks and the fee key.
  const before = BigInt((await query('view_account', owner.id)).amount);
  r = await submitRecovery(helperSigner, owner.id, req, [{ index: 0, sig: guardianSign(req, g[0]) }, { index: 2, sig: guardianSign(req, g[2]) }]);
  assert(r.success, r.error);
  const s2 = await view(owner.id);
  assert.equal(s2.ed, base64.encode(npk.ed)); assert.equal(s2.pq, base64.encode(npk.pq)); assert.equal(s2.recovery_nonce, '1');
  const k2 = (await accessKeys(owner.id)).keys;
  assert.equal(k2.length, 1); assert.equal(k2[0].public_key, 'ed25519:' + base58.encode(npk.ed));
  assert.deepEqual(k2[0].access_key.permission.FunctionCall.method_names, ['execute']);
  pass('2-of-3 guardians rotate both locks; old key removed, new execute-only key added', r.hash);
  assert(BigInt((await query('view_account', owner.id)).amount) > before - NEAR('0.05')); pass('funds untouched by recovery');
  r = await submitRecovery(helperSigner, owner.id, req, [{ index: 0, sig: guardianSign(req, g[0]) }, { index: 2, sig: guardianSign(req, g[2]) }]);
  assert(!r.success && r.error.includes('replay'), r.error); pass('a replayed recovery is refused');

  // Old keys are dead; new keys spend.
  const oldSend = signIntent(makeIntent(owner.id, (await view(owner.id)).nonce, { kind: 'send', receiver: helper.id, amount: nearAmount('0.1') }), up.keys);
  const dead = await submit(fee, owner.id, [actions.call('execute', oldSend)]).then(outcome).catch((e: any) => ({ success: false, error: String(e.message) }));
  assert(!dead.success); pass('the lost device’s keys can no longer act', dead.error.slice(0, 60));
  const newFee: Signer = { account: owner.id, seed: nk.ed };
  const ok = await execute(newFee, owner.id, signIntent(makeIntent(owner.id, (await view(owner.id)).nonce, { kind: 'send', receiver: helper.id, amount: nearAmount('0.1') }), nk));
  assert(ok.success, ok.error); pass('the new device spends with the rotated locks', ok.hash);
  void edKeyString;
  writeFileSync('deployments/sandbox-guardian-tests.json', JSON.stringify({ ranAt: new Date().toISOString(), node: 'neard 2.14.0-rc.4 sandbox (protocol 88)', contract: 'magen-2', count: results.length, results }, null, 2));
  console.log('SANDBOX_GUARDIAN_CASES', results.length);
} finally { await worker.tearDown(); }
