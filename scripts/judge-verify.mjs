#!/usr/bin/env node
// Re-checks every Magen proof against public chain data. No install, no keys, no repo build:
//   node scripts/judge-verify.mjs
// Sources: FastNEAR transaction API (testnet), NEAR testnet RPC, Ethereum Sepolia public RPC,
// and this repo's contract source. Exit code 0 only if every check passes.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const NEAR_RPC = 'https://test.rpc.fastnear.com';
const NEAR_TX_API = 'https://tx.test.fastnear.com/v0/transactions';
const SEPOLIA_RPC = 'https://ethereum-sepolia-rpc.publicnode.com';
const MPC = 'v1.signer-prod.testnet';

const post = async (url, body) => {
  const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  if (!r.ok) throw Error(`${url} answered HTTP ${r.status}`);
  return r.json();
};
const rpc = async (method, params) => { const j = await post(NEAR_RPC, { jsonrpc: '2.0', id: 1, method, params }); if (j.error) throw Error(JSON.stringify(j.error)); return j.result; };
const evm = async (method, params) => { const j = await post(SEPOLIA_RPC, { jsonrpc: '2.0', id: 1, method, params }); if (j.error) throw Error(JSON.stringify(j.error)); return j.result; };

const PROOFS = [
  { what: 'Dual-signed execute: wallet contract verified ed25519 + ML-DSA-65, then sent NEAR', tx: '8zE68ivr8yqCAxMZdH7jfWfCAPmzLUzSrn7DSz95AhoU', expect: 'success' },
  { what: 'Set 2-of-3 ML-DSA-65 guardians (dual-signed)', tx: '4WnbGuP8Ae7wji3qAj836zGFj2XAxJb4rMmeNQoxo6rp', expect: 'success' },
  { what: 'Q-Day switch: native ML-DSA-65 full-access key added (dual-signed)', tx: 'BAWh3doDhZsfYMT7uzrnLS8i59rwLMKdA1TTNE7XZbTF', expect: 'success' },
  { what: 'Quantum-gated Chain Signatures request: MPC signed an Ethereum tx after both locks passed', tx: 'Efwjsz3s1SQfYarn3Mkym8XQxRxNkvifa5cSDFJdHZ6M', expect: 'mpc' },
  { what: 'Same Chain Signatures request WITHOUT the ML-DSA half: refused on chain', tx: '3QXq3Wegps8W2mKb13PoxcjoAMwA2vHzgrdE5UzCW2y8', expect: 'refused', reason: 'quantum half missing' },
  { what: 'Bitcoin testnet deposit minted as nBTC by Omni Bridge', tx: '3ozwi6xYKwSXFWDhbQbANDNWg1YH2rt9XzGSLqbrrj66', expect: 'success' },
  { what: 'Swap NEAR -> USDT on Ref Finance (4 calls, one dual-signed approval)', tx: '244z9RSELiRdQmhvDmV7sxBS3vMw6zNGE8xavcfGQTVi', expect: 'success' },
  { what: 'Bridge out NEAR -> Solana devnet via Omni Bridge (dual-signed)', tx: '7zHBYKkdvHn5umWv3eAVZgiww3FN7NSRmoqaCx7U66at', expect: 'success' },
];
const SEPOLIA = { what: 'Ethereum Sepolia tx broadcast with that MPC signature, from the NEAR-derived address', hash: '0xd8cee16543ec97decb4370d601d3d7e01d0e74dbc11b1132139ec2980a1092c0', from: '0xf06d7f1851db534a680e6e856697cbbd4557a38b' };

const failures = (rs) => rs.map(r => r.execution_outcome?.outcome?.status).filter(s => s && s.Failure).map(s => JSON.stringify(s.Failure));
const rows = [];
const check = (ok, what, detail) => rows.push({ ok, what, detail });

// 1. The contract source really calls NEAR's host functions.
const src = readFileSync(join(ROOT, 'contracts/src/lib.rs'), 'utf8');
check(/env::ml_dsa_verify\(/.test(src) && /env::ed25519_verify\(/.test(src), 'Contract source verifies both signatures with NEAR host functions', 'contracts/src/lib.rs: env::ed25519_verify + env::ml_dsa_verify');

// 2. Every NEAR proof transaction, looked up without trusting our own records.
const api = await post(NEAR_TX_API, { tx_hashes: PROOFS.map(p => p.tx) });
const byHash = Object.fromEntries((api.transactions ?? []).map(t => [t.transaction.hash, t]));
for (const p of PROOFS) {
  const t = byHash[p.tx];
  if (!t) { check(false, p.what, `${p.tx} not found`); continue; }
  const signer = t.transaction.signer_id;
  const fin = await rpc('tx', { tx_hash: p.tx, sender_account_id: signer, wait_until: 'FINAL' }).catch(e => ({ error: e.message }));
  const rs = t.receipts ?? [];
  const fails = failures(rs);
  const link = `https://testnet.near.rocks/tx/${p.tx}`;
  if (fin.error) { check(false, p.what, `RPC: ${fin.error}`); continue; }
  if (p.expect === 'success') check(fails.length === 0, p.what, `${signer} · ${link}`);
  if (p.expect === 'mpc') {
    const mpcOk = rs.some(r => r.execution_outcome?.outcome?.executor_id === MPC && r.execution_outcome.outcome.status?.SuccessValue);
    check(fails.length === 0 && mpcOk, p.what, `${signer} -> ${MPC} returned a signature · ${link}`);
  }
  if (p.expect === 'refused') check(fails.some(f => f.includes(p.reason)), p.what, `failure contains "${p.reason}" · ${link}`);
}

// 3. The Ethereum side of the Chain Signatures send.
const rc = await evm('eth_getTransactionReceipt', [SEPOLIA.hash]).catch(e => ({ error: e.message }));
check(!!rc && rc.status === '0x1' && rc.from?.toLowerCase() === SEPOLIA.from, SEPOLIA.what,
  rc?.error ? rc.error : `status ${rc?.status}, from ${rc?.from}, block ${rc ? parseInt(rc.blockNumber, 16) : '?'} · https://sepolia.etherscan.io/tx/${SEPOLIA.hash}`);

// 3b. Omni Bridge NEAR -> Base Sepolia, paid to the wallet's Chain Signatures EVM address (deployments/bridge-out-base-live.json).
const BASE_RPC = 'https://sepolia.base.org';
const base = async (method, params) => { const j = await post(BASE_RPC, { jsonrpc: '2.0', id: 1, method, params }); if (j.error) throw Error(JSON.stringify(j.error)); return j.result; };
const BASE = { tx: '0x3aee1f45c264db39646cd24a4a7cf4c9d78c2ea731ac7a7fe59d26dd24b1cf19', token: '0xb8cae3ea035ab123c1833258835ef270c9934162', to: '0x3d839b64cc5c1df42819dbce6cc28d5c93a23813' };
const brc = await base('eth_getTransactionReceipt', [BASE.tx]).catch(e => ({ error: e.message }));
const bal = await base('eth_call', [{ to: BASE.token, data: '0x70a08231' + BASE.to.slice(2).padStart(64, '0') }, 'latest']).catch(() => null);
const wnear = bal ? Number(BigInt(bal)) / 1e18 : 0;
check(brc?.status === '0x1' && wnear > 0, 'Omni Bridge NEAR -> Base Sepolia finalised; wNEAR held by the NEAR-derived EVM address',
  brc?.error ?? `status ${brc?.status}, recipient ${BASE.to} holds ${wnear.toFixed(6)} wNEAR · https://sepolia.basescan.org/tx/${BASE.tx}`);

// 4. Live account state after the Q-Day switch: NEAR itself lists an ML-DSA-65 key.
const keys = await rpc('query', { request_type: 'view_access_key_list', account_id: 'maya-safe.testnet', finality: 'final' }).catch(e => ({ error: e.message }));
const pq = (keys.keys ?? []).filter(k => String(k.public_key).startsWith('ml-dsa'));
check(pq.length > 0, 'maya-safe.testnet holds a native ML-DSA-65 access key (NEP-645)', keys.error ?? `${pq.length} ML-DSA key(s): ${pq.map(k => k.public_key.slice(0, 28) + '…').join(', ')}`);

// 5. Live wallet-contract state.
const view = await rpc('query', { request_type: 'call_function', account_id: 'maya-safe.testnet', method_name: 'status', args_base64: '', finality: 'final' }).catch(e => ({ error: e.message }));
let st = null; try { st = JSON.parse(Buffer.from(view.result).toString()); } catch {}
check(!!st && st.version?.startsWith('magen') && st.pq?.length > 0, 'Magen wallet contract live on maya-safe.testnet with an ML-DSA-65 lock', st ? `version ${st.version}, nonce ${st.nonce}, guardians ${st.guardians?.length ?? 0} (threshold ${st.threshold})` : (view.error ?? 'no status'));

const pass = rows.filter(r => r.ok).length;
console.log(`\nMagen live verification · ${new Date().toISOString()}\n`);
for (const r of rows) console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.what}\n      ${r.detail}`);
console.log(`\n${pass}/${rows.length} checks passed.`);
process.exit(pass === rows.length ? 0 : 1);
