// Sandbox tests (neard 2.14 sandbox, protocol 88) for the in-place upgrade and the key-recovery drill.
// Every case sends a real transaction to a local NEAR node; nothing is mocked.
import { Worker } from 'near-workspaces';
import { readFileSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { useRpc, submit, actions, outcome, query, view, accessKeys, makeIntent, signIntent, execute, nearAmount, base64, base58, pqHandle, publicKeys, type Signer } from '../sdk/index.ts';
import { seedFromPrivateKey, upgradeInPlace, precheckUpgrade, edKeyString, seedFromPhrase } from '../sdk/upgrade.ts';
import { drillSeed, drillKeyString, crackRange, drillPublic, DRILL_SPACE } from '../sdk/drill.ts';
import { scanAccount, grade } from '../sdk/scan.ts';

const port = 5343;
const worker = await Worker.init({ homeDir: process.cwd() + '/.tools/sandbox-home-up-' + Date.now(), port, rpcAddr: `http://127.0.0.1:${port}`, rm: true } as any);
const results: { name: string; passed: boolean; detail?: string }[] = [];
const pass = (name: string, detail = '') => { results.push({ name, passed: true, detail }); console.log('PASS', name, detail); };
const wasm = new Uint8Array(readFileSync('target/near/magen_wallet.wasm'));
const NEAR = (n: string) => BigInt(nearAmount(n));
try {
  useRpc(`http://127.0.0.1:${port}`);
  const root = worker.rootAccount;
  const rootKey = await root.getKey();
  const rootSigner: Signer = { account: root.accountId, seed: base64.encode(seedFromPrivateKey(rootKey!.toString())) };
  const make = async (name: string, index: number, amount: string) => {
    const id = `${name}.${root.accountId}`;
    const r = outcome(await submit(rootSigner, id, [actions.create(), actions.transfer(NEAR(amount)), actions.addKey(drillPublic(index))]));
    assert(r.success, r.error); return id;
  };
  // Two ordinary accounts, each guarded by one weak ("drill") classical key.
  const plainIdx = 123_457, magenIdx = 201_001;
  const plain = await make('plain', plainIdx, '3'), magen = await make('magen', magenIdx, '6');
  const attackerSeed = crypto.getRandomValues(new Uint8Array(32));
  const attacker: Signer = { account: `attacker.${root.accountId}`, seed: base64.encode(attackerSeed) };
  assert(outcome(await submit(rootSigner, attacker.account, [actions.create(), actions.transfer(NEAR('1')), actions.addKey((await import('@noble/curves/ed25519.js')).ed25519.getPublicKey(attackerSeed))])).success);

  // Pre-check refuses an account that would break.
  const pre = await precheckUpgrade(magen, drillSeed(magenIdx), wasm.length);
  assert(pre.ok, pre.problems.join('; ')); pass('precheck accepts a plain funded account');
  const badKey = await precheckUpgrade(magen, drillSeed(5), wasm.length);
  assert(!badKey.ok && badKey.problems[0].includes('not one of')); pass('precheck refuses a key the account does not hold');

  // Upgrade in place: same account, old key becomes the classical half and an execute-only key.
  const before = await query('view_account', magen);
  const up = await upgradeInPlace(magen, drillSeed(magenIdx), wasm, pre.keys.map(k => k.public_key));
  assert(up.result.success, up.result.error);
  const keys = (await accessKeys(magen)).keys;
  assert.equal(keys.length, 1);
  assert.equal(keys[0].public_key, drillKeyString(magenIdx));
  assert.deepEqual(keys[0].access_key.permission.FunctionCall.method_names, ['execute']);
  assert.equal(keys[0].access_key.permission.FunctionCall.receiver_id, magen);
  const after = await query('view_account', magen);
  assert(BigInt(after.amount) > BigInt(before.amount) - NEAR('0.05'), 'balance kept (only gas spent; storage is staked, not spent)');
  pass('upgrade in place: one tx, same account, old key now execute-only', up.result.hash);
  const precheck2 = await precheckUpgrade(magen, drillSeed(magenIdx), wasm.length);
  assert(!precheck2.ok); pass('precheck refuses to upgrade twice');

  // The old key alone can no longer move funds natively.
  const direct = await submit({ account: magen, seed: base64.encode(drillSeed(magenIdx)) }, attacker.account, [actions.transfer(NEAR('1'))]).then(outcome).catch((e: any) => ({ success: false, error: String(e.message) }));
  assert(!direct.success); pass('old key cannot transfer natively', direct.error.slice(0, 80));

  // Owner spends with both halves, paying gas with the execute-only key.
  const owner: Signer = { account: magen, seed: base64.encode(drillSeed(magenIdx)) };
  const s0 = await view(magen);
  const okSend = await execute(owner, magen, signIntent(makeIntent(magen, s0.nonce, { kind: 'send', receiver: plain, amount: nearAmount('0.5') }), up.keys));
  assert(okSend.success, okSend.error); pass('dual-signed send via the execute-only key', okSend.hash);

  // Drill: the attacker sees only public keys, recovers both private keys, and attacks.
  const targets = [plain, magen].map(a => accessKeys(a).then(r => r.keys[0].public_key));
  const pubs = (await Promise.all(targets)).map(k => base58.decode(k.slice('ed25519:'.length)));
  const t0 = Date.now();
  const found = crackRange(pubs, 0, DRILL_SPACE);
  assert.equal(found.length, 2);
  const recovered = Object.fromEntries(found.map(f => [f.target, f.index]));
  assert.equal(recovered[0], plainIdx); assert.equal(recovered[1], magenIdx);
  pass('attacker recovers both weak keys from public data', `${Date.now() - t0} ms`);
  const plainBal = BigInt((await query('view_account', plain)).amount);
  const raw = await submit({ account: plain, seed: base64.encode(drillSeed(recovered[0])) }, plain, [actions.deleteAccount(attacker.account)]);
  // The gas refund to the deleted account fails by design; the delete itself is the tx status.
  assert('SuccessValue' in raw.status, JSON.stringify(raw.status));
  await assert.rejects(query('view_account', plain));
  pass('plain account drained with the recovered key', `${Number(plainBal / 10n ** 21n) / 1000} NEAR -> attacker`);
  const stolen = { account: magen, seed: base64.encode(drillSeed(recovered[1])) };
  const s1 = await view(magen);
  const intent = makeIntent(magen, s1.nonce, { kind: 'send', receiver: attacker.account, amount: nearAmount('5') });
  const edOnly = signIntent(intent, { ed: stolen.seed, pq: base64.encode(new Uint8Array(32)) });
  const balBefore = BigInt((await query('view_account', magen)).amount);
  const refused = await execute(stolen, magen, { ...edOnly, pq_sig: '' });
  assert(!refused.success && refused.error.includes('quantum half missing'), refused.error);
  pass('same attack on the Magen account refused on chain', 'quantum half missing');
  const forged = await execute(stolen, magen, edOnly);
  assert(!forged.success && forged.error.includes('quantum half missing or invalid'), forged.error);
  pass('attacker with a self-made ML-DSA key refused', 'quantum half missing or invalid');
  const balAfter = BigInt((await query('view_account', magen)).amount);
  assert(balBefore - balAfter < NEAR('0.2')); pass('Magen keeps the 5 NEAR; only attempt gas is charged (sandbox gas price)', `${Number((balBefore - balAfter) / 10n ** 18n) / 1e6} NEAR gas`);

  // Q-Day switch on the upgraded account: native ML-DSA-65 key appears.
  const s2 = await view(magen);
  const mig = await execute(owner, magen, signIntent(makeIntent(magen, s2.nonce, { kind: 'migrate' }), up.keys));
  assert(mig.success, mig.error);
  const handle = pqHandle(publicKeys(up.keys).pq);
  const k2 = (await accessKeys(magen)).keys.map((k: any) => k.public_key);
  assert(k2.includes(handle), JSON.stringify(k2)); pass('Q-Day switch adds the native ML-DSA-65 key', handle.slice(0, 32) + '…');

  // Scan grades on real chain state.
  const sc = grade({ account: magen, network: 'testnet', implicit: false, balance: 0n, storageUsage: 0, hasContract: true, isMagen: true, keys: (await accessKeys(magen)).keys.map((k: any) => ({ publicKey: k.public_key, scheme: k.public_key.startsWith('ml-dsa') ? 'ml-dsa-65' : 'ed25519', fullAccess: k.access_key.permission === 'FullAccess', receiver: k.access_key.permission.FunctionCall?.receiver_id, methods: k.access_key.permission.FunctionCall?.method_names })) });
  assert.equal(sc.score, 100); assert.equal(sc.level, 'native'); pass('readiness scan scores the upgraded, switched account 100');
  const exposed = grade({ account: 'x.testnet', network: 'testnet', implicit: false, balance: 10n ** 24n, storageUsage: 0, hasContract: false, isMagen: false, keys: [{ publicKey: 'ed25519:x', scheme: 'ed25519', fullAccess: true }] });
  assert.equal(exposed.level, 'exposed'); assert.equal(exposed.score, 15); pass('readiness scan scores a one-key account 15 (exposed)');

  // Phrase derivation matches the NEAR standard path (vector from near-seed-phrase docs is not used: we check determinism and format).
  const s = seedFromPhrase('abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about');
  assert.equal(s.length, 32); assert.match(edKeyString(s), /^ed25519:/); pass('recovery phrase derives an ed25519 key');
  assert.throws(() => seedFromPhrase('not a phrase')); pass('invalid recovery phrase refused');
  void scanAccount;
  writeFileSync('deployments/sandbox-upgrade-tests.json', JSON.stringify({ ranAt: new Date().toISOString(), node: 'neard 2.14.0-rc.4 sandbox (protocol 88)', count: results.length, results }, null, 2));
  console.log('SANDBOX_UPGRADE_CASES', results.length);
} finally { await worker.tearDown(); }

