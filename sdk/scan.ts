// Read-only quantum readiness scan of any NEAR account (mainnet or testnet).
// Everything here comes from public RPC reads: view_account, view_access_key_list, status.
import { rpc } from './index.ts';

export type Net = 'mainnet' | 'testnet';
export const RPCS: Record<Net, string> = { mainnet: 'https://rpc.mainnet.fastnear.com', testnet: 'https://test.rpc.fastnear.com' };
export const EXPLORER: Record<Net, string> = { mainnet: 'https://nearblocks.io', testnet: 'https://testnet.nearblocks.io' };
/** Code hashes of the Magen wallet contract builds (base58 sha256 of the wasm). */
export const MAGEN_CODE = ['BfybLd2PncEnEM3twymN35YYA8q5RheNq1DRSXwpp1p3', '84P7CKENx6FNQDWktEfr1KiSDfGFo4Bq9cZgM41zj7yV'];

export type ScanKey = { publicKey: string; scheme: 'ed25519' | 'secp256k1' | 'ml-dsa-65' | 'other'; fullAccess: boolean; receiver?: string; methods?: string[] };
export type Check = { label: string; ok: boolean; detail: string; points: number };
export type Scan = {
  account: string; network: Net; implicit: boolean; balance: bigint; storageUsage: number; hasContract: boolean; isMagen: boolean;
  magen?: { migrated: boolean; nonce: string }; keys: ScanKey[]; score: number; level: 'exposed' | 'limited' | 'protected' | 'native';
  headline: string; checks: Check[];
};

export function normalise(input: string) {
  return input.trim().toLowerCase().replace(/^https?:\/\/\S*?\/address\//, '').replace(/[/?#].*$/, '');
}
export function networksFor(id: string): Net[] {
  if (id.endsWith('.testnet')) return ['testnet'];
  if (id.endsWith('.near') || id.endsWith('.tg')) return ['mainnet'];
  return ['mainnet', 'testnet'];
}
export const isImplicit = (id: string) => /^[0-9a-f]{64}$/.test(id) || /^0x[0-9a-f]{40}$/.test(id);
export const validAccountId = (id: string) => id.length >= 2 && id.length <= 64 && /^(([a-z\d]+[-_])*[a-z\d]+\.)*([a-z\d]+[-_])*[a-z\d]+$/.test(id);

function schemeOf(k: string): ScanKey['scheme'] {
  if (k.startsWith('ed25519:')) return 'ed25519';
  if (k.startsWith('secp256k1:')) return 'secp256k1';
  if (k.startsWith('ml-dsa-65')) return 'ml-dsa-65';
  return 'other';
}

export async function scanAccount(raw: string): Promise<Scan> {
  const account = normalise(raw);
  if (!validAccountId(account)) throw Error('That is not a NEAR account ID. Try something like alice.near or a 64-character address.');
  let lastErr = '';
  for (const network of networksFor(account)) {
    const ep = RPCS[network];
    let view: any;
    try { view = await rpc('query', { request_type: 'view_account', account_id: account, finality: 'final' }, ep); }
    catch (e: any) { lastErr = String(e.message || e); if (/UNKNOWN_ACCOUNT|does not exist/i.test(lastErr)) continue; throw Error('NEAR RPC did not answer. Try again in a moment.'); }
    let list: any[];
    try { list = (await rpc('query', { request_type: 'view_access_key_list', account_id: account, finality: 'final' }, ep)).keys; }
    catch (e: any) { if (/TOO_MANY_ACCESS_KEYS/.test(String(e.message))) throw Error(`${account} has more than 100 access keys, which is more than this scan reads.`); throw e; }
    const keys: ScanKey[] = list.map(k => {
      const p = k.access_key.permission;
      return p === 'FullAccess'
        ? { publicKey: k.public_key, scheme: schemeOf(k.public_key), fullAccess: true }
        : { publicKey: k.public_key, scheme: schemeOf(k.public_key), fullAccess: false, receiver: p.FunctionCall.receiver_id, methods: p.FunctionCall.method_names };
    });
    const hasContract = view.code_hash !== '11111111111111111111111111111111';
    const isMagen = MAGEN_CODE.includes(view.code_hash);
    let magen: Scan['magen'];
    if (isMagen) {
      try {
        const r = await rpc('query', { request_type: 'call_function', account_id: account, method_name: 'status', args_base64: 'e30=', finality: 'final' }, ep);
        const s = JSON.parse(new TextDecoder().decode(new Uint8Array(r.result)));
        magen = { migrated: !!s.migrated, nonce: String(s.nonce) };
      } catch { /* status unreadable: treat as unknown */ }
    }
    return grade({ account, network, implicit: isImplicit(account), balance: BigInt(view.amount) + BigInt(view.locked), storageUsage: Number(view.storage_usage), hasContract, isMagen, magen, keys });
  }
  throw Error(`No account called ${account} on NEAR mainnet or testnet.`);
}

export function grade(s: Omit<Scan, 'score' | 'level' | 'headline' | 'checks'>): Scan {
  const classicalFull = s.keys.filter(k => k.fullAccess && (k.scheme === 'ed25519' || k.scheme === 'secp256k1'));
  const classicalLimited = s.keys.filter(k => !k.fullAccess && (k.scheme === 'ed25519' || k.scheme === 'secp256k1'));
  const pq = s.keys.filter(k => k.scheme === 'ml-dsa-65');
  const executeOnly = classicalLimited.every(k => s.isMagen && k.receiver === s.account && k.methods?.length === 1 && k.methods[0] === 'execute');
  const checks: Check[] = [
    { label: 'No classical key can move funds alone', ok: classicalFull.length === 0, points: 40,
      detail: classicalFull.length ? `${classicalFull.length} classical full-access key${classicalFull.length > 1 ? 's' : ''} on chain. Whoever derives one controls everything.` : 'No ed25519 or secp256k1 key has full access.' },
    { label: 'A post-quantum signature is required', ok: s.isMagen || (pq.length > 0 && classicalFull.length === 0), points: 30,
      detail: s.isMagen ? 'Magen contract checks ed25519 and ML-DSA-65 on every spend.' : pq.length ? 'A native ML-DSA-65 key is present.' : 'Nothing on this account checks a post-quantum signature.' },
    { label: 'Limited keys cannot spend', ok: classicalLimited.length === 0 || executeOnly, points: 15,
      detail: classicalLimited.length === 0 ? 'No function-call keys.' : executeOnly ? 'The only limited key can ask the contract to act, never authorise.' : `${classicalLimited.length} classical function-call key${classicalLimited.length > 1 ? 's' : ''} for apps.` },
    { label: 'Native ML-DSA-65 key ready for Q-Day', ok: pq.some(k => k.fullAccess), points: 15,
      detail: pq.some(k => k.fullAccess) ? 'NEAR lists a full-access ml-dsa-65-hash key.' : 'Not yet. Magen’s Q-Day switch adds one.' },
  ];
  const score = checks.reduce((n, c) => n + (c.ok ? c.points : 0), 0);
  const level: Scan['level'] = classicalFull.length ? 'exposed' : pq.some(k => k.fullAccess) && s.isMagen ? 'native' : s.isMagen || pq.length ? 'protected' : 'limited';
  const near = Number(s.balance / 10n ** 21n) / 1000;
  const amount = near.toLocaleString('en-US', { maximumFractionDigits: 2, minimumFractionDigits: 2 });
  const headline = level === 'exposed'
    ? `${amount} NEAR rests on ${classicalFull.length === 1 ? 'one classical key' : `${classicalFull.length} classical keys`} anyone can read.`
    : level === 'native' ? `Two locks, plus a native post-quantum key. ${amount} NEAR.`
    : level === 'protected' ? `${amount} NEAR behind two locks.`
    : `No full-access keys. ${amount} NEAR.`;
  return { ...s, score, level, headline, checks };
}
