// Magen v2 live run on NEAR testnet: one mnemonic → a named NEAR account upgraded in place to magen-3
// (ed25519 lock + ML-DSA-65 lock + ML-DSA-65 fee key, all from the same 12 words), then real actions.
// Secrets stay in .demo/v2-main.json (gitignored, mode 600). Public results go to deployments/v2-live.json.
import { readFileSync, writeFileSync, existsSync, chmodSync } from 'node:fs';
import { base64, formatNear, nearAmount, view } from '../sdk/index.ts';
import { newMnemonic, magenKeysFromMnemonic, nearKey } from '../sdk/hd.ts';
import { upgradeInPlace } from '../sdk/upgrade.ts';
import { createWithHelper } from '../sdk/drillflow.ts';
import { PAIRS, swapNearFor, refQuote } from '../sdk/swap.ts';
import { OUT_ROUTES, bridgeOut, outStatus, depositAddress } from '../sdk/omni.ts';
import { deriveAll } from '../sdk/hd.ts';

const SECRET = '.demo/v2-main.json', OUT = 'deployments/v2-live.json';
const step = process.argv[2];
const out: any = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : { network: 'testnet', runs: [] };
const save = () => writeFileSync(OUT, JSON.stringify(out, null, 2));
const log = (what: string, r: any) => { out.runs.push({ at: new Date().toISOString(), what, ...r }); save(); console.log(what, JSON.stringify(r)); };

function wallet() {
  const s = JSON.parse(readFileSync(SECRET, 'utf8'));
  const m = magenKeysFromMnemonic(s.mnemonic);
  return { account: s.account as string, mnemonic: s.mnemonic as string, keys: m.keys, fee: { account: s.account, seed: m.feeSeed, pq: true } };
}

if (step === 'create') {
  const name = process.argv[3]; if (!name) throw Error('usage: create <name>.testnet');
  if (existsSync(SECRET)) throw Error(`${SECRET} already exists; refusing to overwrite`);
  const mnemonic = newMnemonic(); const n = nearKey(mnemonic); const mk = magenKeysFromMnemonic(mnemonic);
  writeFileSync(SECRET, JSON.stringify({ account: name, mnemonic }), { mode: 0o600 }); chmodSync(SECRET, 0o600);
  await createWithHelper(name, n.publicKey);
  const wasm = new Uint8Array(readFileSync('target/near/magen_wallet.wasm'));
  const up = await upgradeInPlace(name, n.seed, wasm, [n.publicKey], mk.keys.pq, undefined, 'ml-dsa', undefined, mk.feeSeed);
  const st = await view(name);
  log('create+upgrade (magen-3)', { account: name, hash: up.result.hash, success: up.result.success, error: up.result.error, version: st.version });
} else if (step === 'swap') {
  const w = wallet(); const pair = PAIRS.find(p => p.id === (process.argv[4] ?? 'usdt'))!;
  const amt = BigInt(nearAmount(process.argv[3] ?? '1'));
  const r = await swapNearFor(w.fee, w.account, w.keys, pair, amt);
  log(`swap ${formatNear(amt.toString(), 2)} NEAR → ${pair.symbol} on Ref`, { account: w.account, hash: r.hash, success: r.success, error: r.error, quote: r.quote.toString(), received: r.received.toString(), logs: r.logs.slice(0, 12) });
} else if (step === 'out') {
  const w = wallet(); const route = OUT_ROUTES.find(r => r.id === (process.argv[4] ?? 'solana'))!;
  const to = deriveAll(w.mnemonic).chains.find(c => c.id === route.id)!.address;
  const amt = BigInt(nearAmount(process.argv[3] ?? '0.5'));
  const r = await bridgeOut(w.fee, w.account, w.keys, route, to, amt);
  log(`bridge out ${formatNear(amt.toString(), 2)} NEAR → ${route.chain} ${route.network}`, { account: w.account, to, hash: r.hash, success: r.success, error: r.error, fee: r.fee.toString(), originNonce: r.originNonce, logs: r.logs.slice(0, 14) });
} else if (step === 'status') {
  const s = await outStatus(process.argv[3]); console.log(JSON.stringify(s, null, 1).slice(0, 3000));
} else if (step === 'deposit') {
  const w = wallet(); for (const c of ['btc', 'zcash'] as const) { const d = await depositAddress(c, w.account); console.log(c, d.address, 'registered', d.registered, 'min', d.minDeposit.toString(), JSON.stringify(d.confirmations)); }
} else if (step === 'quote') {
  const pair = PAIRS[0]; console.log((await refQuote(pair, 10n ** 24n)).toString());
} else throw Error('steps: create <name> | swap <near> [usdt|usdc] | quote');
