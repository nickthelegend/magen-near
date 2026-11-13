// The drill as a sequence of real NEAR testnet transactions, shared by the web app and scripts.
import { ed25519 } from '@noble/curves/ed25519.js';
import { base58, base64 } from '@scure/base';
import { actions, accessKeys, execute, keyString, makeIntent, nearAmount, outcome, query, random, rpc, signIntent, submit, view, type Signer } from './index.ts';
import { drillPublic, drillSeedB64, randomDrillIndex } from './drill.ts';
import { upgradeInPlace } from './upgrade.ts';

export const HELPER = 'https://helper.nearprotocol.com/account';
export const DRILL_FUND = '2';
/** Contract code plus wallet state, in bytes, that the upgrade stakes for storage (measured: 169,619 B for a 167,326 B wasm). */
const STATE_BYTES = 2300;

export type DrillState = {
  version: 1; funder: Signer; created: string;
  plain: { account: string; index: number };
  magen: { account: string; index: number; pq: string };
  attacker: Signer;
  txs: Record<string, { hash: string; success: boolean; error?: string }>;
};

/** Testnet helper: creates `account` with `publicKey` and funds it with 10 test NEAR. One call per minute. */
export async function createWithHelper(account: string, publicKey: string) {
  const r = await fetch(HELPER, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ newAccountId: account, newAccountPublicKey: publicKey }) });
  if (r.status === 429) throw Error('The NEAR testnet helper is rate-limiting this network. Wait a minute and try again.');
  if (!r.ok) throw Error(`The NEAR testnet helper refused to create ${account} (HTTP ${r.status}).`);
  for (let i = 0; i < 20; i++) {
    try { await query('view_account', account); return; } catch { await new Promise(res => setTimeout(res, 1500)); }
  }
  throw Error(`${account} was not visible on chain after 30 seconds.`);
}

type Log = (step: string, detail?: string) => void;

/** Funder creates two look-alike accounts guarded by weak drill keys, an attacker account, then upgrades one in place. */
export async function prepareDrill(funder: Signer, wasm: Uint8Array, log: Log = () => {}, pqSeed?: string): Promise<DrillState> {
  const plainIdx = randomDrillIndex();
  let magenIdx = randomDrillIndex(); while (magenIdx === plainIdx) magenIdx = randomDrillIndex();
  const attacker: Signer = { account: `attacker.${funder.account}`, seed: base64.encode(random()) };
  const st: DrillState = {
    version: 1, funder, created: new Date().toISOString(),
    plain: { account: `plain.${funder.account}`, index: plainIdx },
    magen: { account: `magen.${funder.account}`, index: magenIdx, pq: '' }, attacker, txs: {},
  };
  const create = async (name: string, account: string, pub: Uint8Array, amount: string) => {
    log(name, account);
    const r = outcome(await submit(funder, account, [actions.create(), actions.transfer(BigInt(nearAmount(amount))), actions.addKey(pub)]));
    st.txs[name] = r; if (!r.success) throw Error(`${name} failed: ${r.error}`);
  };
  await create('create plain account', st.plain.account, drillPublic(plainIdx), DRILL_FUND);
  // Same spendable balance as the plain account once the contract's storage is staked.
  const magenFund = (BigInt(nearAmount(DRILL_FUND)) + BigInt(wasm.length + STATE_BYTES) * 10n ** 19n + 2n * 10n ** 21n).toString();
  await create('create Magen account', st.magen.account, drillPublic(magenIdx), (Number(BigInt(magenFund) / 10n ** 18n) / 1e6).toString());
  await create('create attacker account', attacker.account, ed25519.getPublicKey(base64.decode(attacker.seed)), '0.5');
  log('upgrade Magen account in place', st.magen.account);
  const keys = (await accessKeys(st.magen.account)).keys.map((k: any) => k.public_key);
  const up = await upgradeInPlace(st.magen.account, base64.decode(drillSeedB64(magenIdx)), wasm, keys, pqSeed);
  st.txs['upgrade in place'] = up.result; if (!up.result.success) throw Error('upgrade failed: ' + up.result.error);
  st.magen.pq = up.keys.pq;
  return st;
}

/** What the attacker can see: the classical public key of each account, read from the chain. */
export async function readTargets(st: DrillState) {
  const read = async (account: string) => {
    const list = (await accessKeys(account)).keys as any[];
    const k = list.find(k => String(k.public_key).startsWith('ed25519:'));
    if (!k) throw Error(`${account} has no ed25519 key to attack.`);
    return { account, publicKey: k.public_key as string, permission: k.access_key.permission === 'FullAccess' ? 'full access' : `can only call ${k.access_key.permission.FunctionCall.method_names.join(', ')}`, bytes: base58.decode(k.public_key.slice(8)) };
  };
  return [await read(st.plain.account), await read(st.magen.account)];
}

/** Drain the plain account with a recovered key: delete it and send everything to the attacker. */
export async function drainPlain(st: DrillState, recoveredIndex: number, onSigned?: (h: string) => void) {
  const stolen: Signer = { account: st.plain.account, seed: drillSeedB64(recoveredIndex) };
  const raw = await submit(stolen, st.plain.account, [actions.deleteAccount(st.attacker.account)], onSigned);
  // A gas refund to the just-deleted account fails by design; the transaction status is what counts.
  const success = raw.status && 'SuccessValue' in raw.status;
  const r = { hash: raw.transaction.hash as string, success: !!success, error: success ? '' : JSON.stringify(raw.status?.Failure ?? raw.status) };
  st.txs['attacker drains plain account'] = r; return r;
}

/** Same attack on the Magen account: the recovered key signs a transfer; the quantum half is missing. */
export async function attackMagen(st: DrillState, recoveredIndex: number, onSigned?: (h: string) => void) {
  const stolen: Signer = { account: st.magen.account, seed: drillSeedB64(recoveredIndex) };
  const s = await view(st.magen.account);
  const intent = makeIntent(st.magen.account, s.nonce, { kind: 'send', receiver: st.attacker.account, amount: nearAmount('3') });
  const signed = signIntent(intent, { ed: stolen.seed, pq: base64.encode(random()) });
  const r = await execute(stolen, st.magen.account, { ...signed, pq_sig: '' }, onSigned);
  st.txs['attacker tries the Magen account'] = r; return r;
}

/** Balance minus the NEAR staked for storage, so a plain and a contract account compare fairly. null = gone. */
export const spendableOf = async (account: string) => {
  try { const v = await rpc('query', { request_type: 'view_account', account_id: account, finality: 'final' }); return BigInt(v.amount) - BigInt(v.storage_usage) * 10n ** 19n; }
  catch (e: any) { if (/UNKNOWN_ACCOUNT|does not exist/i.test(String(e.message))) return null; throw e; }
};
/** Final-finality balance, so pending gas refunds do not show up as losses. null = the account no longer exists. */
export const balanceOf = async (account: string) => {
  try { return BigInt((await rpc('query', { request_type: 'view_account', account_id: account, finality: 'final' })).amount); }
  catch (e: any) { if (/UNKNOWN_ACCOUNT|does not exist/i.test(String(e.message))) return null; throw e; }
};
export { keyString };
