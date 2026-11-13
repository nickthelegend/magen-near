// "Steal the key, still get nothing": a key-recovery drill.
// Nobody has a quantum computer that breaks ed25519 today. To show what one would do, the
// drill makes classical keys from a deliberately tiny space (2^18 = 262,144 seeds), so an
// ordinary laptop can recover a private key from the public key that NEAR shows anyone.
// Real keys come from a 2^256 space; a laptop cannot do this to them.
import { ed25519 } from '@noble/curves/ed25519.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { base58, base64 } from '@scure/base';
import { concat, utf8 } from './index.ts';

export const DRILL_BITS = 18;
export const DRILL_SPACE = 2 ** DRILL_BITS;
const TAG = utf8('magen-drill-v1:');

export function drillSeed(index: number): Uint8Array {
  if (!Number.isInteger(index) || index < 0 || index >= DRILL_SPACE) throw Error('drill index out of range');
  return sha256(concat(TAG, new Uint8Array([index >>> 24, (index >>> 16) & 255, (index >>> 8) & 255, index & 255])));
}
export const randomDrillIndex = () => crypto.getRandomValues(new Uint32Array(1))[0] % DRILL_SPACE;
export const drillPublic = (index: number) => ed25519.getPublicKey(drillSeed(index));
export const drillKeyString = (index: number) => 'ed25519:' + base58.encode(drillPublic(index));
export const drillSeedB64 = (index: number) => base64.encode(drillSeed(index));

const same = (a: Uint8Array, b: Uint8Array) => a.length === b.length && a.every((x, i) => x === b[i]);

/**
 * Search [from, to) for seeds whose public keys match any target. This is the attacker's
 * whole job: it only ever sees public keys read from the chain.
 */
export function crackRange(targets: Uint8Array[], from: number, to: number, onProgress?: (done: number) => void) {
  const found: { target: number; index: number }[] = [];
  for (let i = from; i < to; i++) {
    const pub = drillPublic(i);
    for (let t = 0; t < targets.length; t++) if (same(pub, targets[t])) found.push({ target: t, index: i });
    if (onProgress && (i - from) % 2048 === 2047) onProgress(i - from + 1);
    if (found.length === targets.length) break;
  }
  return found;
}
