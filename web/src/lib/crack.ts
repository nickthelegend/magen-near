import { DRILL_SPACE } from '../../../sdk/drill.ts';
/** Split the 2^18 drill space over the laptop's cores. Resolves when every target is found or the space is exhausted. */
export function crackInBrowser(targets: Uint8Array[], onProgress: (checked: number) => void) {
  const n = Math.max(2, Math.min(8, (navigator.hardwareConcurrency || 4) - 1));
  const size = Math.ceil(DRILL_SPACE / n);
  const workers: Worker[] = [];
  return new Promise<{ target: number; index: number }[]>((resolve, reject) => {
    const found: { target: number; index: number }[] = [];
    let checked = 0, finished = 0;
    const stop = () => workers.forEach(w => w.terminate());
    for (let i = 0; i < n; i++) {
      const w = new Worker(new URL('./crack.worker.ts', import.meta.url), { type: 'module' });
      workers.push(w);
      w.onerror = e => { stop(); reject(Error('The attacker worker crashed: ' + e.message)); };
      w.onmessage = (e: MessageEvent<any>) => {
        if (e.data.progress) { checked += e.data.progress; onProgress(checked); }
        if (e.data.done) {
          for (const f of e.data.found) if (!found.some(x => x.target === f.target)) found.push(f);
          finished++;
          if (found.length === targets.length || finished === n) { stop(); resolve(found); }
        }
      };
      w.postMessage({ targets, from: i * size, to: Math.min(DRILL_SPACE, (i + 1) * size) });
    }
  });
}
