// In-place upgrade: an existing NEAR account keeps its name, balance and history,
// and gains a second, post-quantum lock. One atomic transaction, signed by the
// account's own key:
//   DeployContract(magen) -> FunctionCall new(ed, pq) -> DeleteKey(every key)
//   -> AddKey(the old key, FunctionCall-only: may call `execute` and nothing else)
// After it lands, the old key is still the first lock (classical half), but it can no
// longer move funds by itself. Every spend also needs the ML-DSA-65 half.
import { ed25519 } from '@noble/curves/ed25519.js';
import { hmac } from '@noble/hashes/hmac.js';
import { sha512 } from '@noble/hashes/sha2.js';
import { mnemonicToSeedSync, validateMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english';
import { base58, base64 } from '@scure/base';
import { actions, accessKeys, concat, generateKeys, outcome, publicKeys, query, random, signerPublic, submit, utf8, type Keys, type Signer } from './index.ts';

export const EMPTY_CODE = '11111111111111111111111111111111';
/** Fee allowance for the execute-only key: the most an attacker holding the classical key alone could burn in gas. */
export const FEE_ALLOWANCE = 10n ** 24n; // 1 NEAR
export const YOCTO_PER_BYTE = 10n ** 19n;
/** The contract refuses to spend the last 0.5 NEAR (storage safety). */
export const CONTRACT_RESERVE = 5n * 10n ** 23n;

/** Parse `ed25519:<base58>` (64-byte secret||public or 32-byte seed) into a 32-byte seed. */
export function seedFromPrivateKey(input: string): Uint8Array {
  const s = input.trim();
  const m = /^ed25519:([1-9A-HJ-NP-Za-km-z]+)$/.exec(s);
  if (!m) throw Error('Paste a private key that starts with ed25519:');
  let raw: Uint8Array;
  try { raw = base58.decode(m[1]); } catch { throw Error('That private key is not valid base58.'); }
  if (raw.length === 64) {
    const seed = raw.slice(0, 32);
    const pub = ed25519.getPublicKey(seed);
    if (pub.some((b, i) => b !== raw[32 + i])) throw Error('That private key does not match its own public half.');
    return seed;
  }
  if (raw.length === 32) return raw;
  throw Error('Expected a 32- or 64-byte ed25519 private key.');
}

/** NEAR wallets derive keys from a BIP-39 phrase with SLIP-10 ed25519 at m/44'/397'/0'. */
export function seedFromPhrase(phrase: string): Uint8Array {
  const words = phrase.trim().toLowerCase().split(/\s+/).join(' ');
  if (!validateMnemonic(words, wordlist)) throw Error('That recovery phrase is not a valid 12 or 24-word phrase.');
  const master = hmac(sha512, utf8('ed25519 seed'), mnemonicToSeedSync(words));
  let key = master.slice(0, 32), chain = master.slice(32);
  for (const index of [44, 397, 0]) {
    const i = (index | 0x80000000) >>> 0;
    const data = concat(new Uint8Array([0]), key, new Uint8Array([i >>> 24, (i >>> 16) & 255, (i >>> 8) & 255, i & 255]));
    const out = hmac(sha512, chain, data);
    key = out.slice(0, 32); chain = out.slice(32);
  }
  return key;
}

export const edKeyString = (seed: Uint8Array) => 'ed25519:' + base58.encode(ed25519.getPublicKey(seed));

export type Precheck = { ok: boolean; problems: string[]; balance: bigint; storageNeeded: bigint; keys: any[] };

/** Read-only checks before an upgrade. Refuses anything that would break the account. */
export async function precheckUpgrade(account: string, seed: Uint8Array, wasmBytes: number): Promise<Precheck> {
  const problems: string[] = [];
  const view = await query('view_account', account).catch(() => null);
  if (!view) return { ok: false, problems: [`${account} does not exist on NEAR testnet.`], balance: 0n, storageNeeded: 0n, keys: [] };
  const list = (await accessKeys(account)).keys as any[];
  const mine = edKeyString(seed);
  const own = list.find(k => k.public_key === mine);
  if (!own) problems.push('This key is not one of the account’s access keys.');
  else if (own.access_key.permission !== 'FullAccess') problems.push('This key is a limited (function-call) key. Use a full-access key.');
  if (view.code_hash !== EMPTY_CODE) problems.push('This account already runs a contract. Magen only upgrades plain accounts, so nothing you run breaks.');
  const odd = list.filter(k => !String(k.public_key).startsWith('ed25519:'));
  if (odd.length) problems.push('This account has non-ed25519 keys. Remove them first.');
  const balance = BigInt(view.amount);
  const storageNeeded = BigInt(wasmBytes + 4000 + Number(view.storage_usage)) * YOCTO_PER_BYTE;
  const need = storageNeeded + CONTRACT_RESERVE + 10n ** 23n;
  if (balance < need) problems.push(`Needs at least ${(Number(need) / 1e24).toFixed(2)} NEAR for contract storage; this account has ${(Number(balance) / 1e24).toFixed(2)}.`);
  return { ok: problems.length === 0, problems, balance, storageNeeded, keys: list };
}

/** Parse "ed25519:<base58>" into the 32 raw public-key bytes. */
const edBytes = (k: string) => base58.decode(k.slice('ed25519:'.length));

/**
 * The upgrade transaction. `keys.ed` is set to the account's existing key, so the key the
 * user already has stays the first lock. Returns the outcome plus the vault material.
 */
/**
 * `feeKey: 'ml-dsa'` (default) gives the account a separate ML-DSA-65 function-call key that may only call `execute`,
 * so NEAR lists zero classical access keys from the first block after the upgrade (NEP-645 allows ML-DSA FC keys).
 * `feeKey: 'ed25519'` re-adds the old key as the execute-only key (used by the key-recovery drill).
 * Returns `fee`, the signer that pays gas for `execute` afterwards.
 */
export async function upgradeInPlace(account: string, seed: Uint8Array, wasm: Uint8Array, existingKeys: string[], pqSeed?: string, onSigned?: (h: string) => void, feeKey: 'ml-dsa' | 'ed25519' = 'ml-dsa', onPrepared?: (vault: {wallet:string;keys:Keys;relay:Signer}) => Promise<void>) {
  const keys: Keys = { ed: base64.encode(seed), pq: pqSeed ?? generateKeys().pq };
  const pk = publicKeys(keys);
  const signer: Signer = { account, seed: base64.encode(seed) };
  const own = edKeyString(seed);
  const feeSeed = feeKey === 'ml-dsa' ? base64.encode(random()) : base64.encode(seed);
  const fee: Signer = feeKey === 'ml-dsa' ? { account, seed: feeSeed, pq: true } : { account, seed: base64.encode(seed) };
  const ops = [
    actions.deploy(wasm),
    actions.call('new', { ed: base64.encode(pk.ed), pq: base64.encode(pk.pq) }, 30_000_000_000_000n),
    ...existingKeys.map(k => actions.deleteKey(edBytes(k))),
    feeKey === 'ml-dsa' ? actions.addFnKey(signerPublic(fee), account, ['execute'], FEE_ALLOWANCE, 2) : actions.addFnKey(edBytes(own), account, ['execute'], FEE_ALLOWANCE),
  ];
  await onPrepared?.({wallet:account,keys,relay:fee});
  const result = outcome(await submit(signer, account, ops, onSigned));
  return { result, keys, signer, fee };
}
