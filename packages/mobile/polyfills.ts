// Hermes gaps the shared SDK relies on: TextDecoder, crypto.getRandomValues (from the iOS secure RNG via expo-crypto)
// and AbortSignal.timeout. No signing code is replaced: ed25519 and ML-DSA-65 run in JS on the device.
import 'fast-text-encoding';
import { getRandomValues } from 'expo-crypto';
const g: any = globalThis;
if (!g.crypto) g.crypto = {};
if (!g.crypto.getRandomValues) g.crypto.getRandomValues = (a: any) => getRandomValues(a);
if (typeof AbortSignal !== 'undefined' && !(AbortSignal as any).timeout) {
  (AbortSignal as any).timeout = (ms: number) => { const c = new AbortController(); setTimeout(() => c.abort(), ms); return c.signal; };
}
