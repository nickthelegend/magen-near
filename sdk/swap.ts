// Real NEAR testnet swap on Ref Finance (ref-finance-101.testnet), signed twice through the Magen wallet.
// One dual-signed `batch` intent (magen-3) runs four calls in order: register on wNEAR, wrap NEAR,
// register on the output token, then ft_transfer_call into Ref with a swap action.
import { base64, execute, makeIntent, signIntent, utf8, view, type Keys, type Signer } from './index.ts';

export const REF = 'ref-finance-101.testnet';
export const WNEAR = 'wrap.testnet';
export type Pair = { id: string; symbol: string; token: string; pool: number; decimals: number; label: string };
/** Liquid testnet pools checked on chain Nov 14 2026 (largest wNEAR pools on Ref testnet). */
export const PAIRS: Pair[] = [
  { id: 'usdt', symbol: 'USDT', token: 'usdt.itachicara.testnet', pool: 1084, decimals: 24, label: 'USDT (Ref testnet token)' },
  { id: 'usdc', symbol: 'USDC', token: 'usdc.itachicara.testnet', pool: 1103, decimals: 24, label: 'USDC (Ref testnet token)' },
];
const STORAGE = 1_250_000_000_000_000_000_000n; // 0.00125 NEAR, the tokens' storage_balance_bounds.min

/** Live quote from the pool itself (Ref `get_return`, fee included). */
export async function refQuote(pair: Pair, amountIn: bigint): Promise<bigint> {
  if (amountIn <= 0n) return 0n;
  return BigInt(await view(REF, 'get_return', { pool_id: pair.pool, token_in: WNEAR, amount_in: amountIn.toString(), token_out: pair.token }));
}
export async function refPool(pair: Pair) {
  const p = await view(REF, 'get_pool', { pool_id: pair.pool });
  const i = p.token_account_ids.indexOf(WNEAR);
  return { near: BigInt(p.amounts[i]), other: BigInt(p.amounts[1 - i]), feeBps: p.total_fee as number };
}
export const ftBalance = async (token: string, account: string) => BigInt(await view(token, 'ft_balance_of', { account_id: account }));

const call = (receiver: string, method: string, args: any, deposit: bigint, gas: number) =>
  ({ receiver, method, args: base64.encode(utf8(JSON.stringify(args))), deposit: deposit.toString(), gas });

/** The batch the wallet signs. `slippageBps` protects min_amount_out. */
export function swapCalls(wallet: string, pair: Pair, amountIn: bigint, quote: bigint, slippageBps = 100) {
  const min = quote * BigInt(10_000 - slippageBps) / 10_000n;
  const msg = JSON.stringify({ force: 0, actions: [{ pool_id: pair.pool, token_in: WNEAR, token_out: pair.token, amount_in: amountIn.toString(), min_amount_out: min.toString() }] });
  return [
    call(WNEAR, 'storage_deposit', { account_id: wallet, registration_only: true }, STORAGE, 10),
    call(WNEAR, 'near_deposit', {}, amountIn, 10),
    call(pair.token, 'storage_deposit', { account_id: wallet, registration_only: true }, STORAGE, 10),
    call(WNEAR, 'ft_transfer_call', { receiver_id: REF, amount: amountIn.toString(), msg }, 1n, 180),
  ];
}

export async function swapNearFor(fee: Signer, wallet: string, keys: Keys, pair: Pair, amountIn: bigint, slippageBps = 100) {
  const quote = await refQuote(pair, amountIn);
  if (quote <= 0n) throw Error('The pool returned no quote. Try a smaller amount.');
  const s = await view(wallet);
  if (s.version !== 'magen-3') throw Error('Swaps need a magen-3 wallet (one dual-signed batch). Create a new wallet to swap.');
  const before = await ftBalance(pair.token, wallet).catch(() => 0n);
  const signed = signIntent(makeIntent(wallet, s.nonce, { kind: 'batch', calls: swapCalls(wallet, pair, amountIn, quote, slippageBps) } as any), keys);
  const r = await execute(fee, wallet, signed);
  const after = await ftBalance(pair.token, wallet).catch(() => before);
  return { ...r, quote, received: after - before };
}
