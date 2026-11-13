// Chain reads for the web app. Everything comes from public NEAR RPC or the NearBlocks API; nothing is invented.
import { rpc, view, accessKeys, decode, base64, formatNear } from '../../../sdk/index.ts';
import { RPCS } from '../../../sdk/scan.ts';

export const EXPLORER = 'https://testnet.near.rocks';
export const txUrl = (h: string) => `${EXPLORER}/tx/${h}`;
export const accountUrl = (a: string) => `${EXPLORER}/account/${a}`;
export const keysUrl = (a: string) => `${EXPLORER}/account/${a}`;

export const short = (s: string, a = 6, b = 4) => (s.length > a + b + 1 ? `${s.slice(0, a)}…${s.slice(-b)}` : s);
export const near = (yocto: string | bigint | null | undefined, places = 2) => (yocto === null || yocto === undefined ? '—' : formatNear(String(yocto), places));

export type AccountView = { amount: bigint; storage: number; codeHash: string };
export async function readAccount(account: string): Promise<AccountView | null> {
  try {
    const v = await rpc('query', { request_type: 'view_account', account_id: account, finality: 'final' });
    return { amount: BigInt(v.amount), storage: Number(v.storage_usage), codeHash: v.code_hash };
  } catch (e: any) {
    if (/UNKNOWN_ACCOUNT|does not exist/i.test(String(e.message))) return null;
    throw e;
  }
}
export async function readStatus(account: string): Promise<{ nonce: string; migrated: boolean; migration_pending: boolean; ed: string; pq: string } | null> {
  try { return await view(account); } catch { return null; }
}
export type KeyInfo = { publicKey: string; scheme: string; full: boolean; methods?: string[]; receiver?: string; allowance?: string | null };
export async function readKeys(account: string): Promise<KeyInfo[]> {
  const r = await accessKeys(account);
  return r.keys.map((k: any) => {
    const p = k.access_key.permission;
    const scheme = k.public_key.startsWith('ml-dsa') ? 'ML-DSA-65' : k.public_key.startsWith('secp256k1') ? 'secp256k1' : 'ed25519';
    return p === 'FullAccess' ? { publicKey: k.public_key, scheme, full: true }
      : { publicKey: k.public_key, scheme, full: false, methods: p.FunctionCall.method_names, receiver: p.FunctionCall.receiver_id, allowance: p.FunctionCall.allowance };
  });
}
export async function networkStatus() {
  const [t, m] = await Promise.all([rpc('status', [], RPCS.testnet), rpc('status', [], RPCS.mainnet)]);
  return { testnet: t.protocol_version as number, mainnet: m.protocol_version as number, height: t.sync_info.latest_block_height as number };
}

export type Activity = {
  hash: string; time: number; kind: 'sent' | 'received' | 'refused' | 'upgrade' | 'qday' | 'call' | 'other';
  title: string; detail: string; amount?: string; success: boolean; counterparty?: string;
};

const errText = (f: any) => {
  const s = JSON.stringify(f ?? '');
  const m = /panicked at [^"]*?\\n([^"\\]+)/.exec(s);
  return m ? m[1].replace(/: \[\]$/, '') : s.includes('NotEnoughAllowance') ? 'fee allowance used up' : 'failed';
};
export const friendlyError = (raw: string) => {
  if (/quantum half missing or invalid/.test(raw)) return 'Refused on chain: the quantum half is invalid.';
  if (/quantum half missing/.test(raw)) return 'Refused on chain: quantum half missing.';
  if (/classical half invalid/.test(raw)) return 'Refused on chain: the classical half is invalid.';
  if (/replay/.test(raw)) return 'Refused on chain: this payment was already used (replay).';
  if (/expired/.test(raw)) return 'Refused on chain: the signed payment expired.';
  if (/keep 0.5 NEAR/.test(raw)) return 'Refused: the wallet keeps 0.5 NEAR for storage.';
  if (/AccountDoesNotExist|does not exist/.test(raw)) return 'That account does not exist on NEAR testnet.';
  if (/NotEnoughAllowance/.test(raw)) return 'The fee key has used its allowance.';
  return raw.length > 220 ? raw.slice(0, 220) + '…' : raw;
};

const dep = (v: any) => typeof v === 'number' ? BigInt(v.toLocaleString('fullwide', { useGrouping: false })).toString() : String(v ?? '0');

/** Account history: NearBlocks lists the transactions; RPC `tx` decodes each Magen intent. */
const actCache = new Map<string, { at: number; p: Promise<Activity[]> }>();
const txCache = new Map<string, any>();
/** Cached for 20 s per account so several screens don't hammer the public APIs. */
export function readActivity(account: string, limit = 25): Promise<Activity[]> {
  const k = `${account}:${limit}`, hit = actCache.get(k);
  if (hit && Date.now() - hit.at < 20000) return hit.p;
  const p = readActivityFresh(account, limit).catch(e => { actCache.delete(k); throw e; });
  actCache.set(k, { at: Date.now(), p }); return p;
}
async function pool<T>(items: T[], n: number, fn: (t: T) => Promise<void>) {
  let i = 0; await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) await fn(items[i++]); }));
}
async function readActivityFresh(account: string, limit: number): Promise<Activity[]> {
  const res = await fetch(`https://api-testnet.nearblocks.io/v1/account/${account}/txns-only?per_page=${limit}&order=desc`, { signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw Error(`NearBlocks history is unavailable right now (HTTP ${res.status}).`);
  const rows = ((await res.json()).txns ?? []) as any[];
  const out: Activity[] = [];
  await pool(rows, 3, async row => {
    const time = Number(BigInt(row.block_timestamp) / 1_000_000n);
    const hash = row.transaction_hash as string;
    const names = (row.actions ?? []).map((a: any) => a.action) as string[];
    const success = row.outcomes?.status !== false;
    const base = { hash, time, success };
    if (names.includes('DEPLOY_CONTRACT')) { out.push({ ...base, kind: 'upgrade', title: 'Upgraded in place', detail: 'Wallet contract deployed, second lock added' }); return; }
    if (row.receiver_account_id === account && row.signer_account_id !== account && names.includes('TRANSFER')) {
      out.push({ ...base, kind: 'received', title: 'Received', detail: `from ${row.signer_account_id}`, amount: dep(row.actions_agg?.deposit), counterparty: row.signer_account_id }); return;
    }
    if (names.includes('CREATE_ACCOUNT')) { out.push({ ...base, kind: 'received', title: 'Account created', detail: `by ${row.signer_account_id}`, amount: dep(row.actions_agg?.deposit) }); return; }
    const execute = (row.actions ?? []).some((a: any) => a.method === 'execute');
    if (!execute) { out.push({ ...base, kind: 'other', title: names.map(n => n.toLowerCase().replace(/_/g, ' ')).join(', ') || 'Transaction', detail: `${row.signer_account_id} → ${row.receiver_account_id}` }); return; }
    try {
      const tx = txCache.get(hash) ?? await rpc('tx', { tx_hash: hash, sender_account_id: row.signer_account_id, wait_until: 'NONE' });
      txCache.set(hash, tx);
      const fc = tx.transaction.actions.find((a: any) => a.FunctionCall)?.FunctionCall;
      const args = JSON.parse(decode(base64.decode(fc.args)));
      const intent = JSON.parse(args.intent);
      const failure = [tx.transaction_outcome, ...tx.receipts_outcome].map((o: any) => o.outcome.status.Failure).find(Boolean);
      const settled = tx.receipts_outcome.flatMap((o: any) => o.outcome.logs).find((l: string) => l.startsWith('MAGEN_SETTLED'));
      const ok = !failure && (!settled || settled.includes('success=true'));
      const a = intent.action;
      if (!ok && failure) { out.push({ ...base, success: false, kind: 'refused', title: 'Refused on chain', detail: errText(failure), amount: a.kind === 'send' ? a.amount : undefined, counterparty: a.receiver }); return; }
      if (a.kind === 'send') out.push({ ...base, success: ok, kind: 'sent', title: 'Sent', detail: `to ${a.receiver} · signed twice`, amount: a.amount, counterparty: a.receiver });
      else if (a.kind === 'migrate') out.push({ ...base, success: ok, kind: 'qday', title: 'Q-Day switch', detail: 'Native ML-DSA-65 key added' });
      else out.push({ ...base, success: ok, kind: 'call', title: `Called ${a.method}`, detail: `on ${a.receiver} · signed twice`, counterparty: a.receiver });
    } catch {
      out.push({ ...base, kind: success ? 'call' : 'refused', title: success ? 'Wallet action' : 'Refused on chain', detail: 'execute' });
    }
  });
  return out.sort((a, b) => b.time - a.time);
}

export const ago = (t: number) => {
  const s = Math.max(1, Math.round((Date.now() - t) / 1000));
  if (s < 60) return `${s}s ago`; if (s < 3600) return `${Math.round(s / 60)}m ago`; if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};
