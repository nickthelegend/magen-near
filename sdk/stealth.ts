// Private send on NEAR: one-time receiving accounts (stealth payments).
// The recipient publishes a Magen meta-key (an X25519 public key derived from their wallet's ML-DSA seed).
// The sender makes a fresh ephemeral X25519 key, derives a shared secret, and from it a one-time ed25519 key whose
// implicit account (64 hex chars) receives the payment. The sender hands the recipient a short note (the ephemeral
// public key). Only the recipient can derive the one-time private key.
// Hidden: the link between this payment and the recipient's main account. NOT hidden: sender, amount, timing,
// and anything the recipient later does that links the one-time account back (for example sweeping to main).
import { ed25519, x25519 } from '@noble/curves/ed25519.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { base58, base64 } from '@scure/base';
import { actions, concat, random, submit, utf8, type Keys } from './index.ts';

const hex = (b: Uint8Array) => Array.from(b, x => x.toString(16).padStart(2, '0')).join('');
/** The recipient's scan secret, derived from their wallet's ML-DSA-65 seed (never leaves the device). */
export const metaSecret = (k: Keys) => sha256(concat(utf8('magen-meta-v1:'), base64.decode(k.pq)));
export const metaKey = (k: Keys) => 'magen-meta:' + base58.encode(x25519.getPublicKey(metaSecret(k)));
const parseMeta = (m: string) => {
  const r = /^magen-meta:([1-9A-HJ-NP-Za-km-z]{40,48})$/.exec(m.trim()); if (!r) throw Error('That is not a Magen meta-key (magen-meta:…).');
  const b = base58.decode(r[1]); if (b.length !== 32) throw Error('Meta-key must be 32 bytes.'); return b;
};
const oneTimeSeed = (shared: Uint8Array) => sha256(concat(utf8('magen-stealth-v1:'), shared));
export const implicitOf = (seed: Uint8Array) => hex(ed25519.getPublicKey(seed));

/** Sender side: a fresh one-time account for this payment, plus the note to give the recipient. */
export function newStealthPayment(meta: string) {
  const eph = random();
  const shared = x25519.getSharedSecret(eph, parseMeta(meta));
  const seed = oneTimeSeed(shared);
  return { account: implicitOf(seed), note: 'magen-note:' + base58.encode(x25519.getPublicKey(eph)) };
}
/** Recipient side: from the note, re-derive the one-time account and its private key. */
export function openStealthNote(k: Keys, note: string) {
  const r = /^magen-note:([1-9A-HJ-NP-Za-km-z]{40,48})$/.exec(note.trim()); if (!r) throw Error('That is not a Magen payment note (magen-note:…).');
  const shared = x25519.getSharedSecret(metaSecret(k), base58.decode(r[1]));
  const seed = oneTimeSeed(shared);
  return { account: implicitOf(seed), seed: base64.encode(seed) };
}
/** Move everything from a one-time account to `to` (closes it). Note: sweeping to your main account re-links them. */
export const sweep = (oneTime: { account: string; seed: string }, to: string) => submit(oneTime, oneTime.account, [actions.deleteAccount(to)]);
