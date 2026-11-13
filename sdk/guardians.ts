// Guardians (contract magen-2): k-of-n ML-DSA-65 keys that can rotate both locks if the owner loses the device.
import { ml_dsa65 } from '@noble/post-quantum/ml-dsa.js';
import { base64, actions, outcome, random, sha256, submit, utf8, type Action, type Signer } from './index.ts';

export type Guardian = { name: string; seed: string };
export const newGuardian = (name: string): Guardian => ({ name, seed: base64.encode(random()) });
export const guardianPublic = (g: Guardian) => ml_dsa65.keygen(base64.decode(g.seed)).publicKey;

/** Dual-signed owner action that sets (or clears, with []) the guardian set. */
export const setGuardians = (pubs: Uint8Array[], threshold: number): Action => ({ kind: 'guardians', keys: pubs.map(p => base64.encode(p)), threshold });

export function makeRecovery(wallet: string, nonce: string, newEd: Uint8Array, newPq: Uint8Array, expires = Date.now() + 300_000) {
  return JSON.stringify({ network: 'testnet', wallet, nonce, expires: String(expires), new_ed: base64.encode(newEd), new_pq: base64.encode(newPq) });
}
export const recoveryDigest = (request: string) => sha256(utf8('magen:recover:v1:' + request));
export function guardianSign(request: string, g: Guardian) {
  return base64.encode(ml_dsa65.sign(recoveryDigest(request), ml_dsa65.keygen(base64.decode(g.seed)).secretKey));
}
/** Anyone can submit a recovery (a guardian's account usually pays the gas). */
export async function submitRecovery(payer: Signer, wallet: string, request: string, signatures: { index: number; sig: string }[]) {
  return outcome(await submit(payer, wallet, [actions.call('recover', { request, signatures }, 150_000_000_000_000n)]));
}
