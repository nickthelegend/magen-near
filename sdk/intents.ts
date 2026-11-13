// Swaps and bridges through NEAR Intents (1Click API). QUOTE ONLY: 1Click runs on mainnet and needs a funded
// mainnet account to execute; there is no testnet. Every quote here is `dry: true` and moves nothing.
const API = 'https://1click.chaindefuser.com/v0';
export type Asset = { symbol: string; chain: string; assetId: string; decimals: number; price?: number };
/** The assets Magen offers. Cosmos (ATOM) is not in 1Click's token list, so it is not offered. */
export const ROUTES: { symbol: string; chain: string; label: string; recipientType: 'DESTINATION_CHAIN' | 'INTENTS' }[] = [
  { symbol: 'wNEAR', chain: 'near', label: 'NEAR', recipientType: 'INTENTS' },
  { symbol: 'ZEC', chain: 'zec', label: 'Zcash', recipientType: 'INTENTS' },
  { symbol: 'SOL', chain: 'sol', label: 'Solana', recipientType: 'DESTINATION_CHAIN' },
  { symbol: 'ETH', chain: 'eth', label: 'Ethereum', recipientType: 'DESTINATION_CHAIN' },
  { symbol: 'BTC', chain: 'btc', label: 'Bitcoin', recipientType: 'DESTINATION_CHAIN' },
];
let cache: Asset[] | null = null;
export async function intentsAssets(): Promise<Asset[]> {
  if (cache) return cache;
  const r = await fetch(`${API}/tokens`, { signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw Error(`1Click token list unavailable (HTTP ${r.status}).`);
  const all = await r.json();
  cache = ROUTES.map(x => all.find((t: any) => t.symbol === x.symbol && t.blockchain === x.chain)).filter(Boolean)
    .map((t: any) => ({ symbol: t.symbol, chain: t.blockchain, assetId: t.assetId, decimals: t.decimals, price: t.price }));
  return cache;
}
const units = (amount: string, decimals: number) => { const [a, b = ''] = amount.split('.'); return (BigInt(a || '0') * 10n ** BigInt(decimals) + BigInt((b + '0'.repeat(decimals)).slice(0, decimals) || '0')).toString(); };

/**
 * A dry 1Click quote. `recipient` must be valid on the destination chain (or a NEAR account for INTENTS routes).
 * Returns amountOut, USD values and time estimate. Execution: "Quote only — mainnet funding required".
 */
export async function intentsQuote(from: string, to: string, amount: string, recipient: string) {
  const assets = await intentsAssets();
  const a = assets.find(x => x.symbol === from), b = assets.find(x => x.symbol === to), route = ROUTES.find(x => x.symbol === to)!;
  if (!a || !b) throw Error(`1Click does not list ${!a ? from : to} right now.`);
  const body = {
    dry: true, swapType: 'EXACT_INPUT', slippageTolerance: 100, originAsset: a.assetId, depositType: 'ORIGIN_CHAIN',
    destinationAsset: b.assetId, amount: units(amount, a.decimals), refundTo: 'near', refundType: 'ORIGIN_CHAIN',
    recipient, recipientType: route.recipientType, deadline: new Date(Date.now() + 10 * 60_000).toISOString(),
  };
  const r = await fetch(`${API}/quote`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(30000) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw Error(`1Click: ${j.message ?? 'quote failed'} (HTTP ${r.status}).`);
  return { from: a, to: b, amountIn: j.quote.amountInFormatted, amountOut: j.quote.amountOutFormatted, usdIn: j.quote.amountInUsd, usdOut: j.quote.amountOutUsd, seconds: j.quote.timeEstimate, recipientType: route.recipientType, status: 'Quote only — mainnet funding required' as const };
}
