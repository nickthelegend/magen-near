// One scripted run of the key-recovery drill on NEAR testnet. Resumable; never repeats a done step.
// Secrets stay in .demo/drill-live.json (gitignored, mode 600). Public hashes go to deployments/drill-live.json.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { base64, keyString, random, formatNear } from '../sdk/index.ts';
import { crackRange, DRILL_SPACE } from '../sdk/drill.ts';
import { createWithHelper, prepareDrill, readTargets, drainPlain, attackMagen, balanceOf, type DrillState } from '../sdk/drillflow.ts';

const secret = '.demo/drill-live.json';
let st: DrillState & { recovered?: number[]; balances?: any; crackMs?: number; targets?: any } = existsSync(secret) ? JSON.parse(readFileSync(secret, 'utf8')) : null as any;
const save = () => {
  writeFileSync(secret, JSON.stringify(st), { mode: 0o600 });
  writeFileSync('deployments/drill-live.json', JSON.stringify({
    network: 'testnet', created: st.created, funder: st.funder.account, plain: st.plain.account, magen: st.magen.account, attacker: st.attacker.account,
    keySpace: `2^18 = ${DRILL_SPACE} seeds (weakened on purpose)`, targets: st.targets, crackMs: st.crackMs, balances: st.balances,
    transactions: Object.entries(st.txs).map(([name, t]) => ({ name, ...t })),
  }, null, 2));
};
if (!st) {
  const funder = { account: `drill-${Date.now().toString(36)}.testnet`, seed: base64.encode(random()) };
  await createWithHelper(funder.account, keyString(funder));
  const wasm = new Uint8Array(readFileSync('target/near/magen_wallet.wasm'));
  st = await prepareDrill(funder, wasm, (s, d) => console.log('·', s, d ?? ''));
  save();
}
const fmt = (b: bigint | null) => (b === null ? 'gone' : formatNear(String(b), 2));
if (!st.recovered) {
  st.balances = { before: { plain: fmt(await balanceOf(st.plain.account)), magen: fmt(await balanceOf(st.magen.account)) } };
  const targets = await readTargets(st);
  st.targets = targets.map(t => ({ account: t.account, publicKey: t.publicKey, permission: t.permission }));
  const t0 = Date.now();
  const found = crackRange(targets.map(t => t.bytes), 0, DRILL_SPACE);
  st.crackMs = Date.now() - t0;
  if (found.length !== 2) throw Error('drill keys not recovered');
  st.recovered = [0, 1].map(t => found.find(f => f.target === t)!.index);
  console.log('recovered', st.recovered, st.crackMs, 'ms'); save();
}
if (!st.txs['attacker drains plain account']) { console.log('drain', (await drainPlain(st, st.recovered![0])).hash); save(); }
if (!st.txs['attacker tries the Magen account']) { const r = await attackMagen(st, st.recovered![1]); console.log('magen', r.hash, r.success, r.error.slice(0, 160)); save(); }
st.balances.note = 'balances at final finality; the attacker account received the plain account’s balance';
st.balances.after = { plain: fmt(await balanceOf(st.plain.account)), magen: fmt(await balanceOf(st.magen.account)), attacker: fmt(await balanceOf(st.attacker.account)) };
save();
console.log(JSON.stringify(st.balances));
