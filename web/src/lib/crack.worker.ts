// The drill attacker, one slice of the weakened key space per worker. It only receives public keys.
import { crackRange } from '../../../sdk/drill.ts';
self.onmessage = (e: MessageEvent<{ targets: Uint8Array[]; from: number; to: number }>) => {
  const { targets, from, to } = e.data;
  let last = 0;
  const found = crackRange(targets, from, to, done => { (self as any).postMessage({ progress: done - last }); last = done; });
  (self as any).postMessage({ done: true, found, progress: 0 });
};
