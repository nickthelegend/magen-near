// Omni Bridge on NEAR testnet (omni.n-bridge.testnet), driven by the Magen wallet.
// Out: wNEAR leaves NEAR for the user's own address on another chain (Solana devnet, Sepolia, Base Sepolia…)
//      in ONE dual-signed batch intent; the bridge relayer finalises it on the destination chain.
// In:  Bitcoin testnet3 and Zcash testnet (transparent) deposit addresses derived on chain by the
//      connectors for the user's NEAR account, cross-checked against the Omni API before showing them.
import { base64, execute, makeIntent, signIntent, utf8, view, type Keys, type Signer } from './index.ts';

export const OMNI = 'omni.n-bridge.testnet';
export const OMNI_API = 'https://testnet.api.bridge.nearone.org';
export const WNEAR = 'wrap.testnet';
export const UTXO = {
  btc: { name: 'Bitcoin', network: 'testnet3', connector: 'btc-connector.n-bridge.testnet', token: 'nbtc.n-bridge.testnet', symbol: 'nBTC', unit: 'sats', decimals: 8, explorerTx: (t: string) => `https://blockstream.info/testnet/tx/${t}` },
  zcash: { name: 'Zcash', network: 'testnet (transparent)', connector: 'zcash_connector.n-bridge.testnet', token: 'nzcash.n-bridge.testnet', symbol: 'nZEC', unit: 'zats', decimals: 8, explorerTx: (t: string) => `https://testnet.zcashexplorer.app/transactions/${t}` },
} as const;
export type UtxoChain = keyof typeof UTXO;

export type OutRoute = { id: string; chain: string; prefix: 'sol' | 'eth' | 'base' | 'arb' | 'avax'; network: string; explorerTx: (h: string) => string; explorerAddr: (a: string) => string };
export const OUT_ROUTES: OutRoute[] = [
  { id: 'solana', chain: 'Solana', prefix: 'sol', network: 'devnet', explorerTx: h => `https://explorer.solana.com/tx/${h}?cluster=devnet`, explorerAddr: a => `https://explorer.solana.com/address/${a}?cluster=devnet` },
  { id: 'base', chain: 'Base', prefix: 'base', network: 'Base Sepolia', explorerTx: h => `https://sepolia.basescan.org/tx/${h}`, explorerAddr: a => `https://sepolia.basescan.org/address/${a}` },
  { id: 'ethereum', chain: 'Ethereum', prefix: 'eth', network: 'Sepolia', explorerTx: h => `https://sepolia.etherscan.io/tx/${h}`, explorerAddr: a => `https://sepolia.etherscan.io/address/${a}` },
  { id: 'arbitrum', chain: 'Arbitrum', prefix: 'arb', network: 'Arbitrum Sepolia', explorerTx: h => `https://sepolia.arbiscan.io/tx/${h}`, explorerAddr: a => `https://sepolia.arbiscan.io/address/${a}` },
];
/** wNEAR's SPL mint on Solana devnet, as the bridge reports it (get_token_address). */
export const WNEAR_SOL_MINT = '3wQct2e43J1Z99h2RWrhPAhf6E32ZpuzEt6tgwfEAKAy';

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(OMNI_API + path, { ...init, signal: AbortSignal.timeout(15000) });
  if (!r.ok) throw Error(`Omni Bridge API answered HTTP ${r.status}`);
  return r.json() as Promise<T>;
}

/** Live fee quote: paid in wNEAR out of the amount sent. */
export async function outFee(sender: string, route: OutRoute, recipient: string, amount: bigint) {
  const q = await api<{ transferred_token_fee: string | null; native_token_fee: string | null; usd_fee: number }>(
    `/api/v3/transfer-fee?sender=near:${sender}&recipient=${route.prefix}:${recipient}&token=near:${WNEAR}&amount=${amount}`);
  if (!q.transferred_token_fee) throw Error('The bridge did not quote a fee for this route right now.');
  return { fee: BigInt(q.transferred_token_fee), usd: q.usd_fee };
}

const call = (receiver: string, method: string, args: any, deposit: bigint, gas: number) =>
  ({ receiver, method, args: base64.encode(utf8(JSON.stringify(args))), deposit: deposit.toString(), gas });

export async function outCalls(wallet: string, route: OutRoute, recipient: string, amount: bigint, fee: bigint) {
  const [reg, init, have] = await Promise.all([
    view(OMNI, 'required_balance_for_account', {}), view(OMNI, 'required_balance_for_init_transfer', {}),
    view(OMNI, 'storage_balance_of', { account_id: wallet }).catch(() => null),
  ]);
  const need = BigInt(reg) + BigInt(init) - (have?.available ? BigInt(have.available) : 0n);
  const msg = JSON.stringify({ recipient: `${route.prefix}:${recipient}`, fee: fee.toString(), native_token_fee: '0', msg: null });
  return [
    call(WNEAR, 'storage_deposit', { account_id: wallet, registration_only: true }, 1_250_000_000_000_000_000_000n, 10),
    call(WNEAR, 'near_deposit', {}, amount, 10),
    call(OMNI, 'storage_deposit', { account_id: wallet }, need > 0n ? need : 0n, 10),
    call(WNEAR, 'ft_transfer_call', { receiver_id: OMNI, amount: amount.toString(), memo: null, msg }, 1n, 200),
  ];
}

export async function bridgeOut(fee: Signer, wallet: string, keys: Keys, route: OutRoute, recipient: string, amount: bigint) {
  const q = await outFee(wallet, route, recipient, amount);
  if (q.fee >= amount) throw Error('The amount does not cover the bridge fee.');
  const s = await view(wallet);
  if (s.version !== 'magen-3') throw Error('Bridging needs a magen-3 wallet (one dual-signed batch).');
  const signed = signIntent(makeIntent(wallet, s.nonce, { kind: 'batch', calls: await outCalls(wallet, route, recipient, amount, q.fee) } as any), keys);
  const r = await execute(fee, wallet, signed);
  const ev = r.logs.find(l => l.includes('InitTransferEvent') || l.includes('init_transfer'));
  let nonce: string | null = null;
  try { const j = JSON.parse(ev!.replace(/^EVENT_JSON:/, '')); nonce = String(JSON.stringify(j).match(/"origin_nonce":\s*"?(\d+)/)?.[1] ?? ''); } catch { /* status lookup by tx hash still works */ }
  return { ...r, fee: q.fee, originNonce: nonce };
}

export type OmniStatus = { status: string; destTx?: string; raw: any };
/** Follows a NEAR-origin transfer by its NEAR transaction hash. */
export async function outStatus(nearTx: string): Promise<OmniStatus | null> {
  const j = await api<{ transfers: any[] }>(`/api/v4/transfers?transaction_id=${nearTx}&offset=0&limit=1`).catch(() => ({ transfers: [] }));
  const t = j.transfers?.[0]; if (!t) return null;
  const fin = t.finalised ?? null;
  const destTx = fin?.transaction_hash ?? fin?.details?.signature ?? fin?.details?.transaction_hash ?? undefined;
  const status = String(t.status ?? (fin ? 'Finalised' : t.signed?.length ? 'Signed' : 'Initialised'));
  return { status, destTx, raw: t };
}

/** Deposit address for bridging BTC/ZEC in. The connector derives it on chain; the API must agree. */
export async function depositAddress(chain: UtxoChain, account: string) {
  const c = UTXO[chain];
  const onChain = await view(c.connector, 'get_user_deposit_address', { deposit_msg: { recipient_id: account } }) as string;
  const r = await api<{ address?: string }>(`/api/v3/utxo/get_user_deposit_address`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ chain, recipient: account }) });
  if (r.address && r.address !== onChain) throw Error('The bridge API and the connector disagree on the deposit address. Not showing it.');
  const cfg = await view(c.connector, 'get_config', {});
  return { address: onChain, registered: !!r.address, minDeposit: BigInt(cfg.min_deposit_amount ?? 0), confirmations: cfg.confirmations_strategy, feeMin: BigInt(cfg.deposit_bridge_fee?.fee_min ?? 0) };
}
export const bridgedBalance = async (chain: UtxoChain, account: string) => BigInt(await view(UTXO[chain].token, 'ft_balance_of', { account_id: account }));
