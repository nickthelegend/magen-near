// Moves leftover testnet NEAR from our earlier demo accounts back to the relay, because the testnet
// helper (faucet) is rate-limiting. Every move is a real transaction; Magen accounts use dual-signed sends.
import { readFileSync, writeFileSync } from 'node:fs';
import { actions, execute, makeIntent, nearAmount, outcome, signIntent, submit, view, rpc } from '../sdk/index.ts';
import { drillSeedB64 } from '../sdk/drill.ts';
const live = JSON.parse(readFileSync('.demo/live.json', 'utf8'));
const vault = JSON.parse(readFileSync('.demo/vault.json', 'utf8'));
const drill = JSON.parse(readFileSync('.demo/drill-live.json', 'utf8'));
const relay = live.relay.account;
const bal = async (a: string) => BigInt((await rpc('query', { request_type: 'view_account', account_id: a, finality: 'final' })).amount);
const Y = (n: string) => BigInt(nearAmount(n));
const log: any[] = [];
const plain = async (signer: any, keep: string) => {
  const b = await bal(signer.account); const amt = b - Y(keep);
  if (amt <= 0n) return;
  const r = outcome(await submit(signer, relay, [actions.transfer(amt)])); log.push({ from: signer.account, amount: amt.toString(), ...r });
};
const dual = async (wallet: string, keys: any, signer: any) => {
  const v = await rpc('query', { request_type: 'view_account', account_id: wallet, finality: 'final' });
  const amt = BigInt(v.amount) - BigInt(v.storage_usage) * 10n ** 19n - Y('0.52');
  if (amt <= 0n) return;
  const s = await view(wallet);
  const r = await execute(signer, wallet, signIntent(makeIntent(wallet, s.nonce, { kind: 'send', receiver: relay, amount: amt.toString() }), keys));
  log.push({ from: wallet, amount: amt.toString(), kind: 'dual-signed', ...r });
};
await plain(drill.attacker, '0.02');
await dual(vault.wallet, vault.keys, vault.relay);
const mSeed = drillSeedB64(drill.recovered?.[1] ?? drill.magen.index);
await dual(drill.magen.account, { ed: mSeed, pq: drill.magen.pq }, { account: drill.magen.account, seed: mSeed });
writeFileSync('deployments/consolidate.json', JSON.stringify(log.map(({ logs, ...x }) => x), null, 2));
console.log(log.map(x => `${x.from} ${Number(BigInt(x.amount) / 10n ** 21n) / 1000} ${x.success} ${x.hash}`).join('\n'));
console.log('relay now', Number((await bal(relay)) / 10n ** 21n) / 1000);
