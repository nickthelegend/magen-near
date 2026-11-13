// One quantum-safe key, every chain: NEAR Chain Signatures behind Magen's hybrid gate.
// The Magen wallet contract only calls the MPC signer after ed25519 + ML-DSA-65 both verify on NEAR, so the
// MPC derives addresses from the wallet account itself (predecessor) and nobody can request a signature
// for them without both signatures. The MPC network and the other chains' own signatures stay classical.
import { secp256k1 } from '@noble/curves/secp256k1.js';
import { keccak_256 } from '@noble/hashes/sha3.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { ripemd160 } from '@noble/hashes/legacy.js';
import { base58, base64, bech32 } from '@scure/base';
import { concat, decode, execute, makeIntent, rpc, signIntent, utf8, view, type Keys, type Signer } from './index.ts';

export const MPC = 'v1.signer-prod.testnet';
export type ChainId = 'ethereum' | 'bitcoin' | 'solana' | 'cosmos';
export const CHAINS: { id: ChainId; name: string; domain: 0 | 1; path: string; network: string; scheme: string }[] = [
  { id: 'ethereum', name: 'Ethereum', domain: 0, path: 'magen/eth', network: 'Sepolia / local Anvil', scheme: 'secp256k1 (ECDSA)' },
  { id: 'bitcoin', name: 'Bitcoin', domain: 0, path: 'magen/btc', network: 'testnet4', scheme: 'secp256k1 (ECDSA)' },
  { id: 'solana', name: 'Solana', domain: 1, path: 'magen/sol', network: 'devnet', scheme: 'ed25519 (EdDSA)' },
  { id: 'cosmos', name: 'Cosmos Hub', domain: 0, path: 'magen/cosmos', network: 'theta testnet', scheme: 'secp256k1 (ECDSA)' },
];

export async function derivedKey(wallet: string, path: string, domain: 0 | 1): Promise<string> {
  const r = await rpc('query', { request_type: 'call_function', account_id: MPC, method_name: 'derived_public_key', args_base64: base64.encode(utf8(JSON.stringify({ path, predecessor: wallet, domain_id: domain }))), finality: 'final' });
  return JSON.parse(decode(new Uint8Array(r.result)));
}
const uncompressed = (k: string) => concat(new Uint8Array([4]), base58.decode(k.slice('secp256k1:'.length)));
const compressed = (k: string) => secp256k1.Point.fromBytes(uncompressed(k)).toBytes(true);
const hash160 = (b: Uint8Array) => ripemd160(sha256(b));
const hex = (b: Uint8Array) => Array.from(b, x => x.toString(16).padStart(2, '0')).join('');

export function addressFor(chain: ChainId, key: string) {
  if (chain === 'ethereum') { const h = keccak_256(uncompressed(key).slice(1)); return '0x' + hex(h.slice(12)); }
  if (chain === 'bitcoin') { const w = bech32.toWords(hash160(compressed(key))); return bech32.encode('tb', [0, ...w]); }
  if (chain === 'cosmos') return bech32.encode('cosmos', bech32.toWords(hash160(compressed(key))));
  return key.slice('ed25519:'.length); // Solana: the ed25519 public key in base58
}

export async function allAddresses(wallet: string) {
  return Promise.all(CHAINS.map(async c => { const key = await derivedKey(wallet, c.path, c.domain); return { ...c, key, address: addressFor(c.id, key) }; }));
}

/** Ask the MPC for a signature through the Magen wallet: both owner signatures are verified on NEAR first. */
export async function gatedSign(fee: Signer, wallet: string, keys: Keys, payload: { Ecdsa: string } | { Eddsa: string }, path: string, domain: 0 | 1, opts: { dropPq?: boolean } = {}) {
  const args = { request: { payload_v2: payload, path, domain_id: domain } };
  const s = await view(wallet);
  const signed = signIntent(makeIntent(wallet, s.nonce, { kind: 'call', receiver: MPC, method: 'sign', args: base64.encode(utf8(JSON.stringify(args))), deposit: '1' }), keys);
  const r = await execute(fee, wallet, opts.dropPq ? { ...signed, pq_sig: '' } : signed);
  if (!r.success) return { ...r, signature: null as any };
  const tx = await rpc('tx', { tx_hash: r.hash, sender_account_id: fee.account, wait_until: 'FINAL' });
  const out = tx.receipts_outcome.map((o: any) => o.outcome).find((o: any) => o.executor_id === MPC && o.status?.SuccessValue);
  return { ...r, signature: out ? JSON.parse(decode(base64.decode(out.status.SuccessValue))) : null };
}

// ---------- Ethereum (EIP-1559) ----------
const rlpLen = (n: number, off: number) => n < 56 ? new Uint8Array([off + n]) : (() => { const b = bigBytes(BigInt(n)); return concat(new Uint8Array([off + 55 + b.length]), b); })();
function bigBytes(v: bigint) { if (v === 0n) return new Uint8Array(); let h = v.toString(16); if (h.length % 2) h = '0' + h; return Uint8Array.from(h.match(/../g)!.map(x => parseInt(x, 16))); }
type R = Uint8Array | bigint | R[];
function rlp(x: R): Uint8Array {
  if (Array.isArray(x)) { const body = concat(...x.map(rlp)); return concat(rlpLen(body.length, 0xc0), body); }
  const b = typeof x === 'bigint' ? bigBytes(x) : x;
  return b.length === 1 && b[0] < 0x80 ? b : concat(rlpLen(b.length, 0x80), b);
}
const hexBytes = (h: string) => Uint8Array.from((h.replace(/^0x/, '').match(/../g) ?? []).map(x => parseInt(x, 16)));
export type EthTx = { chainId: bigint; nonce: bigint; maxPriorityFeePerGas: bigint; maxFeePerGas: bigint; gas: bigint; to: string; value: bigint };
const ethFields = (t: EthTx): R[] => [t.chainId, t.nonce, t.maxPriorityFeePerGas, t.maxFeePerGas, t.gas, hexBytes(t.to), t.value, new Uint8Array(), []];
export const ethSigningHash = (t: EthTx) => keccak_256(concat(new Uint8Array([2]), rlp(ethFields(t))));
/** Assemble the raw tx from the MPC's ECDSA answer and check it recovers to our derived address. */
export function ethAssemble(t: EthTx, mpc: any, expectFrom: string) {
  const r = hexBytes(mpc.big_r.affine_point).slice(1), s = hexBytes(mpc.s.scalar), v = BigInt(mpc.recovery_id);
  const sig = new secp256k1.Signature(BigInt('0x' + hex(r)), BigInt('0x' + hex(s))).addRecoveryBit(Number(v));
  const pub = sig.recoverPublicKey(ethSigningHash(t)).toBytes(false);
  const from = '0x' + hex(keccak_256(pub.slice(1)).slice(12));
  if (from !== expectFrom.toLowerCase()) throw Error(`MPC signature recovers to ${from}, not ${expectFrom}`);
  return '0x' + hex(concat(new Uint8Array([2]), rlp([...ethFields(t), v, r, s])));
}
export async function evm(url: string, method: string, params: any[]) {
  const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) });
  const j = await r.json(); if (j.error) throw Error(JSON.stringify(j.error)); return j.result;
}
export { hex as toHex };
