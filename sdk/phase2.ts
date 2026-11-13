// Phase 2 for every Magen surface (web, extension, phone): one quantum-safe key for every chain,
// private send on NEAR, and NEAR Intents quotes. Thin, stable wrappers over chains.ts / stealth.ts / intents.ts.
import { execute, makeIntent, nearAmount, query, signIntent, view, type Keys, type Signer } from './index.ts';
import { allAddresses, ethAssemble, ethSigningHash, gatedSign, toHex, type EthTx, type ChainId } from './chains.ts';
import { newStealthPayment, openStealthNote, sweep } from './stealth.ts';
export { intentsQuote, intentsAssets, ROUTES as INTENT_ROUTES } from './intents.ts';
export { metaKey } from './stealth.ts';
export { MPC, CHAINS } from './chains.ts';
export type { EthTx, ChainId };

/** Addresses on Ethereum, Bitcoin testnet4, Solana and Cosmos that NEAR's MPC derives for this Magen wallet. Read-only. */
export const chainAddresses = (wallet: string) => allAddresses(wallet);

/**
 * Ask the MPC for a signature through the wallet contract (ed25519 + ML-DSA-65 verified on NEAR first).
 * Ethereum: pass `{ chain: 'ethereum', tx, from }` and get back a broadcastable raw tx. Otherwise pass a raw payload.
 */
export async function signCrossChain(fee: Signer, wallet: string, keys: Keys,
  req: { chain: 'ethereum'; tx: EthTx; from: string; path?: string } | { payload: { Ecdsa: string } | { Eddsa: string }; path: string; domain: 0 | 1 },
  opts: { dropPq?: boolean } = {}) {
  if ('chain' in req) {
    const r = await gatedSign(fee, wallet, keys, { Ecdsa: toHex(ethSigningHash(req.tx)) }, req.path ?? 'magen/eth', 0, opts);
    return { ...r, raw: r.signature ? ethAssemble(req.tx, r.signature, req.from) : undefined };
  }
  return { ...(await gatedSign(fee, wallet, keys, req.payload, req.path, req.domain, opts)), raw: undefined };
}

/** Private send: pay a one-time account derived from the recipient's meta-key (signed twice). Give them `note`. */
export async function stealthSend(fee: Signer, wallet: string, keys: Keys, recipientMetaKey: string, amountNear: string) {
  const pay = newStealthPayment(recipientMetaKey);
  const s = await view(wallet);
  const r = await execute(fee, wallet, signIntent(makeIntent(wallet, s.nonce, { kind: 'send', receiver: pay.account, amount: nearAmount(amountNear) }), keys));
  return { ...r, account: pay.account, note: pay.note };
}
/** Recipient: open a payment note, get the one-time account, its key and its balance (null = empty or spent). */
export async function stealthScan(keys: Keys, note: string) {
  const o = openStealthNote(keys, note);
  const balance = await query('view_account', o.account).then((v: any) => BigInt(v.amount), () => null);
  return { ...o, balance };
}
/** Recipient: move everything from the one-time account to `to`. Sweeping to your main account links them again. */
export async function stealthSweep(oneTime: { account: string; seed: string }, to: string) {
  const r = await sweep(oneTime, to);
  return { hash: r.transaction.hash as string, success: !!(r.status && 'SuccessValue' in r.status) };
}
