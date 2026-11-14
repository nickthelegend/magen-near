// One recovery phrase, every chain. Classical chain keys come from BIP-32 (secp256k1) and SLIP-10 (ed25519);
// Magen's ML-DSA-65 keys come from the SAME BIP-39 seed through HKDF-SHA-256 with a domain-separated label,
// so writing down 12 words backs up the NEAR ed25519 key, the post-quantum key and every other chain address.
// Pure JS (noble/scure), no node-only modules: runs in browsers and React Native.
import { HDKey } from '@scure/bip32';
import { generateMnemonic, mnemonicToSeedSync, validateMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english';
import { ed25519 } from '@noble/curves/ed25519.js';
import { secp256k1 } from '@noble/curves/secp256k1.js';
import { hkdf } from '@noble/hashes/hkdf.js';
import { hmac } from '@noble/hashes/hmac.js';
import { ripemd160 } from '@noble/hashes/legacy.js';
import { sha256, sha512 } from '@noble/hashes/sha2.js';
import { keccak_256 } from '@noble/hashes/sha3.js';
import { base58, base64, bech32, createBase58check } from '@scure/base';
import { ml_dsa65 } from '@noble/post-quantum/ml-dsa.js';
import { pqHandle, utf8, type Keys } from './index.ts';

const b58check = createBase58check(sha256);
const hex = (b: Uint8Array) => Array.from(b, x => x.toString(16).padStart(2, '0')).join('');
const hash160 = (b: Uint8Array) => ripemd160(sha256(b));
const norm = (m: string) => m.trim().toLowerCase().split(/\s+/).join(' ');

/** A fresh 12-word English BIP-39 phrase (128 bits of entropy). */
export function newMnemonic(): string { return generateMnemonic(wordlist, 128); }
/** True when the phrase has valid words and a valid BIP-39 checksum. */
export function validMnemonic(m: string): boolean { return validateMnemonic(norm(m), wordlist); }
/** The 64-byte BIP-39 seed (empty passphrase). Throws on an invalid phrase. */
export function mnemonicSeed(m: string): Uint8Array {
  if (!validMnemonic(m)) throw Error('Invalid recovery phrase: check the words and their order.');
  return mnemonicToSeedSync(norm(m), '');
}
const seedOf = (m: string | Uint8Array) => typeof m === 'string' ? mnemonicSeed(m) : m;

// ---------- SLIP-10 ed25519 (hardened only) ----------
const HARD = 0x80000000;
function parsePath(path: string): number[] {
  if (!/^m(\/\d+'?)*$/.test(path)) throw Error(`Bad derivation path ${path}`);
  return path.split('/').slice(1).map(p => p.endsWith("'") ? (parseInt(p) + HARD) >>> 0 : parseInt(p));
}
/** SLIP-10 ed25519 private key (32-byte seed) at a fully hardened path. */
export function slip10Ed25519(seed: Uint8Array, path: string): Uint8Array {
  let I = hmac(sha512, utf8('ed25519 seed'), seed);
  let k = I.slice(0, 32), c = I.slice(32);
  for (const i of parsePath(path)) {
    if (i < HARD) throw Error(`SLIP-10 ed25519 supports hardened steps only (${path})`);
    const data = new Uint8Array(37);
    data.set(k, 1);
    new DataView(data.buffer).setUint32(33, i, false);
    I = hmac(sha512, c, data);
    k = I.slice(0, 32); c = I.slice(32);
  }
  return k;
}
function secp(seed: Uint8Array, path: string) {
  const node = HDKey.fromMasterSeed(seed).derive(path);
  if (!node.privateKey || !node.publicKey) throw Error(`No key at ${path}`);
  return { privateKey: node.privateKey, publicKey: node.publicKey };
}

// ---------- address encoders ----------
export function eip55(addr20: Uint8Array): string {
  const lower = hex(addr20), h = hex(keccak_256(utf8(lower)));
  return '0x' + Array.from(lower, (ch, i) => parseInt(h[i], 16) >= 8 ? ch.toUpperCase() : ch).join('');
}
export const ethAddressOf = (compressedPub: Uint8Array) =>
  eip55(keccak_256(secp256k1.Point.fromBytes(compressedPub).toBytes(false).slice(1)).slice(12));
export const segwitV0 = (hrp: string, pub: Uint8Array) => bech32.encode(hrp, [0, ...bech32.toWords(hash160(pub))]);
export const p2pkh = (version: number[], pub: Uint8Array) => b58check.encode(Uint8Array.from([...version, ...hash160(pub)]));

// ---------- per-chain derivation ----------
export const PATHS = {
  bitcoin: "m/84'/1'/0'/0/0", bitcoinMainnet: "m/84'/0'/0'/0/0", ethereum: "m/44'/60'/0'/0/0",
  solana: "m/44'/501'/0'/0'", near: "m/44'/397'/0'", cosmos: "m/44'/118'/0'/0/0",
  zcash: "m/44'/1'/0'/0/0", litecoin: "m/84'/1'/0'/0/0", dogecoin: "m/44'/1'/0'/0/0",
} as const;
export function bitcoinAddress(m: string | Uint8Array, opts: { mainnet?: boolean } = {}) {
  return opts.mainnet ? segwitV0('bc', secp(seedOf(m), PATHS.bitcoinMainnet).publicKey) : segwitV0('tb', secp(seedOf(m), PATHS.bitcoin).publicKey);
}
/** EVM key at m/44'/60'/0'/0/0; one address for Sepolia, Base Sepolia, Arbitrum Sepolia and Avalanche Fuji C-chain. */
export function ethKey(m: string | Uint8Array) { const k = secp(seedOf(m), PATHS.ethereum); return { ...k, address: ethAddressOf(k.publicKey) }; }
export const ethAddress = (m: string | Uint8Array) => ethKey(m).address;
export function solanaKey(m: string | Uint8Array) {
  const secret = slip10Ed25519(seedOf(m), PATHS.solana), publicKey = ed25519.getPublicKey(secret);
  return { secret, publicKey, address: base58.encode(publicKey) };
}
export const solanaAddress = (m: string | Uint8Array) => solanaKey(m).address;
/** NEAR m/44'/397'/0' (the path near-seed-phrase and NEAR wallets use). `seed` is the 32-byte ed25519 private seed (= Keys.ed). */
export function nearKey(m: string | Uint8Array) {
  const seed = slip10Ed25519(seedOf(m), PATHS.near), pk = ed25519.getPublicKey(seed);
  return { seed, implicit: hex(pk), publicKey: 'ed25519:' + base58.encode(pk) };
}
export const cosmosAddress = (m: string | Uint8Array) => bech32.encode('cosmos', bech32.toWords(hash160(secp(seedOf(m), PATHS.cosmos).publicKey)));
/** Zcash transparent testnet P2PKH (version 0x1D25, "tm…"). */
export const zcashAddress = (m: string | Uint8Array) => p2pkh([0x1d, 0x25], secp(seedOf(m), PATHS.zcash).publicKey);
/** Litecoin testnet native segwit ("tltc1…"). */
export const litecoinAddress = (m: string | Uint8Array) => segwitV0('tltc', secp(seedOf(m), PATHS.litecoin).publicKey);
/** Dogecoin testnet P2PKH (version 0x71, "n…"). */
export const dogecoinAddress = (m: string | Uint8Array) => p2pkh([0x71], secp(seedOf(m), PATHS.dogecoin).publicKey);

// ---------- ML-DSA-65 from the same seed ----------
const SALT = utf8('magen');
export const PQ_INFO = 'magen:ml-dsa-65:v1', PQ_FEE_INFO = 'magen:ml-dsa-65:fee:v1';
/** 32-byte ML-DSA-65 keygen seed = HKDF-SHA-256(ikm = BIP-39 seed, salt "magen", info). */
export const pqSeed = (m: string | Uint8Array, info: string = PQ_INFO) => hkdf(sha256, seedOf(m), SALT, utf8(info), 32);

export type MagenKeys = { keys: Keys; feeSeed: string; near: { implicit: string; publicKey: string } };
/** Everything Magen's NEAR wallet needs from one phrase: hybrid Keys (ed25519 + ML-DSA-65), the fee key's ML-DSA seed, and the NEAR implicit account. */
export function magenKeysFromMnemonic(m: string): MagenKeys {
  const seed = mnemonicSeed(m), n = nearKey(seed);
  return { keys: { ed: base64.encode(n.seed), pq: base64.encode(pqSeed(seed)) }, feeSeed: base64.encode(pqSeed(seed, PQ_FEE_INFO)), near: { implicit: n.implicit, publicKey: n.publicKey } };
}

// ---------- every chain at once ----------
export type ChainAccount = { id: string; name: string; symbol: string; network: string; path: string; scheme: 'secp256k1' | 'ed25519'; address: string; explorer: (addr: string) => string };
const evm = (id: string, name: string, symbol: string, network: string, base: string) =>
  ({ id, name, symbol, network, path: PATHS.ethereum, scheme: 'secp256k1' as const, explorer: (a: string) => `${base}/address/${a}` });
export function deriveAll(m: string): { chains: ChainAccount[]; pqHandle: string; feePqHandle: string } {
  const seed = mnemonicSeed(m), eth = ethKey(seed).address, near = nearKey(seed).implicit;
  const chains: ChainAccount[] = [
    { id: 'near', name: 'NEAR', symbol: 'NEAR', network: 'testnet', path: PATHS.near, scheme: 'ed25519', address: near, explorer: a => `https://testnet.nearblocks.io/address/${a}` },
    { id: 'bitcoin', name: 'Bitcoin', symbol: 'tBTC', network: 'testnet3', path: PATHS.bitcoin, scheme: 'secp256k1', address: bitcoinAddress(seed), explorer: a => `https://blockstream.info/testnet/address/${a}` },
    { ...evm('ethereum', 'Ethereum', 'ETH', 'sepolia', 'https://sepolia.etherscan.io'), address: eth },
    { ...evm('base', 'Base', 'ETH', 'base-sepolia', 'https://sepolia.basescan.org'), address: eth },
    { ...evm('arbitrum', 'Arbitrum', 'ETH', 'arbitrum-sepolia', 'https://sepolia.arbiscan.io'), address: eth },
    { ...evm('avalanche', 'Avalanche C-Chain', 'AVAX', 'fuji', 'https://testnet.snowtrace.io'), address: eth },
    { id: 'solana', name: 'Solana', symbol: 'SOL', network: 'devnet', path: PATHS.solana, scheme: 'ed25519', address: solanaAddress(seed), explorer: a => `https://explorer.solana.com/address/${a}?cluster=devnet` },
    { id: 'cosmos', name: 'Cosmos Hub', symbol: 'ATOM', network: 'ics-testnet-provider', path: PATHS.cosmos, scheme: 'secp256k1', address: cosmosAddress(seed), explorer: a => `https://explorer.polypore.xyz/provider/account/${a}` },
    { id: 'zcash', name: 'Zcash (transparent)', symbol: 'TAZ', network: 'testnet', path: PATHS.zcash, scheme: 'secp256k1', address: zcashAddress(seed), explorer: a => `https://testnet.zcashexplorer.app/address/${a}` },
    { id: 'litecoin', name: 'Litecoin', symbol: 'tLTC', network: 'testnet', path: PATHS.litecoin, scheme: 'secp256k1', address: litecoinAddress(seed), explorer: a => `https://litecoinspace.org/testnet/address/${a}` },
    { id: 'dogecoin', name: 'Dogecoin', symbol: 'tDOGE', network: 'testnet', path: PATHS.dogecoin, scheme: 'secp256k1', address: dogecoinAddress(seed), explorer: a => `https://doge-testnet-explorer.qed.me/address/${a}` },
  ];
  const handle = (info: string) => pqHandle(ml_dsa65.keygen(pqSeed(seed, info)).publicKey);
  return { chains, pqHandle: handle(PQ_INFO), feePqHandle: handle(PQ_FEE_INFO) };
}
