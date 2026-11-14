// Live balances and sends for the addresses sdk/hd.ts derives from one recovery phrase.
// Every reader calls a real public testnet endpoint with a timeout. When an endpoint is down the call throws a
// readable error; when a chain has no public testnet API at all it returns { unsupported } instead of a number.
// Pure fetch + noble/scure: browser and React Native compatible.
import { secp256k1 } from '@noble/curves/secp256k1.js';
import { ed25519 } from '@noble/curves/ed25519.js';
import { keccak_256 } from '@noble/hashes/sha3.js';
import { base58, base64 } from '@scure/base';
import { concat, query } from './index.ts';
import { ethKey, solanaKey } from './hd.ts';

export type Balance = { amount: string; decimals: number; symbol: string };
export type BalanceResult = Balance | { unsupported: string };
const TIMEOUT = 15000;

async function getJson(label: string, url: string, init?: RequestInit): Promise<any> {
  let res: Response;
  try { res = await fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT) }); }
  catch (e: any) { throw Error(`${label} is unreachable right now (${e?.name === 'TimeoutError' ? `no answer in ${TIMEOUT / 1000}s` : e?.message ?? e}).`); }
  const text = await res.text();
  if (!res.ok) throw Error(`${label} answered HTTP ${res.status}: ${text.slice(0, 160)}`);
  try { return JSON.parse(text); } catch { throw Error(`${label} returned something that is not JSON: ${text.slice(0, 120)}`); }
}
async function jsonRpc(label: string, url: string, method: string, params: unknown): Promise<any> {
  const j = await getJson(label, url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) });
  if (j.error) throw Error(`${label} ${method} failed: ${j.error.message ?? JSON.stringify(j.error)}`);
  return j.result;
}

// ---------- endpoints ----------
export const ENDPOINTS = {
  bitcoin: 'https://blockstream.info/testnet/api',
  litecoin: 'https://litecoinspace.org/testnet/api',
  solana: 'https://api.devnet.solana.com',
  cosmos: ['https://rest.provider-sentry-01.ics-testnet.polypore.xyz', 'https://rest.provider-sentry-02.ics-testnet.polypore.xyz'],
};
export const EVM_CHAINS = {
  ethereum: { label: 'Ethereum Sepolia', url: 'https://ethereum-sepolia-rpc.publicnode.com', chainId: 11155111n, symbol: 'ETH' },
  base: { label: 'Base Sepolia', url: 'https://base-sepolia-rpc.publicnode.com', chainId: 84532n, symbol: 'ETH' },
  arbitrum: { label: 'Arbitrum Sepolia', url: 'https://arbitrum-sepolia-rpc.publicnode.com', chainId: 421614n, symbol: 'ETH' },
  avalanche: { label: 'Avalanche Fuji C-Chain', url: 'https://avalanche-fuji-c-chain-rpc.publicnode.com', chainId: 43113n, symbol: 'AVAX' },
} as const;
export type EvmChain = keyof typeof EVM_CHAINS;

// ---------- balance readers ----------
async function esplora(label: string, base: string, address: string, symbol: string): Promise<Balance> {
  const j = await getJson(label, `${base}/address/${address}`);
  const c = j.chain_stats, m = j.mempool_stats;
  const sats = BigInt(c.funded_txo_sum) - BigInt(c.spent_txo_sum) + BigInt(m.funded_txo_sum) - BigInt(m.spent_txo_sum);
  return { amount: sats.toString(), decimals: 8, symbol };
}
/** Bitcoin testnet3 balance in satoshis, confirmed + mempool (Blockstream Esplora). */
export const bitcoinBalance = (address: string) => esplora('Blockstream testnet API', ENDPOINTS.bitcoin, address, 'tBTC');
/** Litecoin testnet balance in litoshis, confirmed + mempool (litecoinspace.org Esplora). */
export const litecoinBalance = (address: string) => esplora('litecoinspace.org testnet API', ENDPOINTS.litecoin, address, 'tLTC');
/** Native balance in wei on Sepolia, Base Sepolia, Arbitrum Sepolia or Avalanche Fuji (publicnode RPC). */
export async function evmBalance(chain: EvmChain, address: string): Promise<Balance> {
  const c = EVM_CHAINS[chain];
  return { amount: BigInt(await jsonRpc(c.label + ' RPC', c.url, 'eth_getBalance', [address, 'latest'])).toString(), decimals: 18, symbol: c.symbol };
}
/** Solana devnet balance in lamports. */
export async function solanaBalance(address: string): Promise<Balance> {
  const r = await jsonRpc('Solana devnet RPC', ENDPOINTS.solana, 'getBalance', [address, { commitment: 'confirmed' }]);
  return { amount: String(r.value), decimals: 9, symbol: 'SOL' };
}
/** NEAR testnet balance in yoctoNEAR through the SDK's rpc. An implicit account that was never funded does not exist yet: 0. */
export async function nearBalance(account: string): Promise<Balance> {
  try { return { amount: (await query('view_account', account)).amount, decimals: 24, symbol: 'NEAR' }; }
  catch (e: any) { if (/UNKNOWN_ACCOUNT|does not exist/.test(String(e?.message))) return { amount: '0', decimals: 24, symbol: 'NEAR' }; throw e; }
}
/** Cosmos Hub ICS testnet (provider chain) balance in uatom, via Hypha's public REST sentries. */
export async function cosmosBalance(address: string): Promise<Balance> {
  let last: unknown;
  for (const base of ENDPOINTS.cosmos) {
    try {
      const j = await getJson('Cosmos ICS testnet REST', `${base}/cosmos/bank/v1beta1/balances/${address}`);
      return { amount: j.balances?.find((b: any) => b.denom === 'uatom')?.amount ?? '0', decimals: 6, symbol: 'ATOM' };
    } catch (e) { last = e; }
  }
  throw last;
}
export const UNSUPPORTED = {
  zcash: 'no public Zcash testnet API answers (probed Nov 14 2026: explorer.testnet.z.cash down, testnet.zcashexplorer.app has no JSON API)',
  dogecoin: 'no public Dogecoin testnet API answers (probed Nov 14 2026: QED electrs demo down, chain.so and BlockCypher have no testnet API)',
};
/** Balance for any chain id from deriveAll(). */
export async function balanceOf(id: string, address: string): Promise<BalanceResult> {
  if (id in EVM_CHAINS) return evmBalance(id as EvmChain, address);
  switch (id) {
    case 'bitcoin': return bitcoinBalance(address);
    case 'litecoin': return litecoinBalance(address);
    case 'solana': return solanaBalance(address);
    case 'near': return nearBalance(address);
    case 'cosmos': return cosmosBalance(address);
    case 'zcash': case 'dogecoin': return { unsupported: UNSUPPORTED[id] };
    default: throw Error(`Unknown chain ${id}`);
  }
}

// ---------- Solana devnet: airdrop + hand-built System transfer ----------
const solRpc = (method: string, params: unknown[]) => jsonRpc('Solana devnet RPC', ENDPOINTS.solana, method, params);
const SYSTEM_PROGRAM = new Uint8Array(32);
export function compactU16(n: number): Uint8Array {
  if (!Number.isInteger(n) || n < 0 || n > 0xffff) throw Error('compact-u16 out of range');
  const out: number[] = [];
  for (;;) { const b = n & 0x7f; n >>= 7; if (!n) { out.push(b); break; } out.push(b | 0x80); }
  return Uint8Array.from(out);
}
const u64le = (v: bigint) => { const b = new Uint8Array(8); new DataView(b.buffer).setBigUint64(0, v, true); return b; };
/** Legacy message with one System Program Transfer instruction (index 2, u64 lamports). */
export function solanaTransferMessage(from: Uint8Array, to: Uint8Array, lamports: bigint, recentBlockhash: string): Uint8Array {
  const data = concat(Uint8Array.from([2, 0, 0, 0]), u64le(lamports));
  return concat(
    Uint8Array.from([1, 0, 1]),                          // 1 signer, 0 read-only signed, 1 read-only unsigned (System Program)
    compactU16(3), from, to, SYSTEM_PROGRAM,
    base58.decode(recentBlockhash),
    compactU16(1), Uint8Array.from([2]), compactU16(2), Uint8Array.from([0, 1]), compactU16(data.length), data,
  );
}
async function solanaConfirm(signature: string, timeoutMs = 60000): Promise<string> {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    const st = (await solRpc('getSignatureStatuses', [[signature], { searchTransactionHistory: true }])).value[0];
    if (st?.err) throw Error(`Solana tx ${signature} failed: ${JSON.stringify(st.err)}`);
    if (st && (st.confirmationStatus === 'confirmed' || st.confirmationStatus === 'finalized')) return st.confirmationStatus;
    await new Promise(r => setTimeout(r, 1500));
  }
  throw Error(`Solana tx ${signature} was not confirmed within ${timeoutMs / 1000}s.`);
}
/** Devnet faucet through RPC requestAirdrop. Resolves with the confirmed signature; throws a readable error when rate-limited or
 * when the RPC faucet is closed (api.devnet.solana.com answered HTTP 410 when probed Nov 14 2026, pointing to the captcha'd web faucet). */
export async function solanaAirdrop(address: string, lamports: bigint | number): Promise<string> {
  let sig: string;
  try { sig = await solRpc('requestAirdrop', [address, Number(lamports), { commitment: 'confirmed' }]); }
  catch (e: any) {
    if (/HTTP 410|faucet is closed/i.test(e.message)) throw Error('Solana devnet RPC faucet is closed (HTTP 410): request test SOL at https://faucet.solana.com, then send from this address.');
    throw Error(/429|limit|airdrop/i.test(e.message) ? `Solana devnet airdrop refused (rate limit or faucet dry): ${e.message}` : e.message);
  }
  await solanaConfirm(sig);
  return sig;
}
/** Send lamports on devnet from the phrase's SLIP-10 Solana key. Resolves with the confirmed signature. */
export async function solanaSend(m: string, to: string, lamports: bigint | number): Promise<string> {
  const key = solanaKey(m), dest = base58.decode(to);
  if (dest.length !== 32) throw Error('Solana address must decode to 32 bytes.');
  if (key.address === to) throw Error('Sending to yourself is not a transfer.');
  const { value } = await solRpc('getLatestBlockhash', [{ commitment: 'confirmed' }]);
  const msg = solanaTransferMessage(key.publicKey, dest, BigInt(lamports), value.blockhash);
  const sig = ed25519.sign(msg, key.secret);
  const signature = await solRpc('sendTransaction', [base64.encode(concat(compactU16(1), sig, msg)), { encoding: 'base64', preflightCommitment: 'confirmed' }]);
  if (signature !== base58.encode(sig)) throw Error(`RPC returned signature ${signature}, expected ${base58.encode(sig)}`);
  await solanaConfirm(signature);
  return signature;
}

// ---------- EVM: EIP-1559 transfer signed with the derived key ----------
type R = Uint8Array | bigint | R[];
const hex = (b: Uint8Array) => Array.from(b, x => x.toString(16).padStart(2, '0')).join('');
const hexBytes = (h: string) => Uint8Array.from((h.replace(/^0x/, '').match(/../g) ?? []).map(x => parseInt(x, 16)));
function bigBytes(v: bigint) { if (v === 0n) return new Uint8Array(); let h = v.toString(16); if (h.length % 2) h = '0' + h; return hexBytes(h); }
function rlpLen(n: number, off: number) { if (n < 56) return Uint8Array.from([off + n]); const b = bigBytes(BigInt(n)); return concat(Uint8Array.from([off + 55 + b.length]), b); }
export function rlp(x: R): Uint8Array {
  if (Array.isArray(x)) { const body = concat(...x.map(rlp)); return concat(rlpLen(body.length, 0xc0), body); }
  const b = typeof x === 'bigint' ? bigBytes(x) : x;
  return b.length === 1 && b[0] < 0x80 ? b : concat(rlpLen(b.length, 0x80), b);
}
export type Eip1559 = { chainId: bigint; nonce: bigint; maxPriorityFeePerGas: bigint; maxFeePerGas: bigint; gas: bigint; to: string; value: bigint };
const fields = (t: Eip1559): R[] => [t.chainId, t.nonce, t.maxPriorityFeePerGas, t.maxFeePerGas, t.gas, hexBytes(t.to), t.value, new Uint8Array(), []];
/** Sign an EIP-1559 transfer; returns the 0x02-typed raw transaction and its hash. */
export function signEip1559(t: Eip1559, privateKey: Uint8Array) {
  if (!/^0x[0-9a-fA-F]{40}$/.test(t.to)) throw Error('EVM recipient must be a 0x + 40 hex address.');
  const h = keccak_256(concat(Uint8Array.from([2]), rlp(fields(t))));
  const sig = secp256k1.Signature.fromBytes(secp256k1.sign(h, privateKey, { prehash: false, format: 'recovered' }), 'recovered');
  const raw = concat(Uint8Array.from([2]), rlp([...fields(t), BigInt(sig.recovery!), sig.r, sig.s]));
  return { raw: '0x' + hex(raw), hash: '0x' + hex(keccak_256(raw)) };
}
/** Send `weiValue` from the phrase's m/44'/60'/0'/0/0 address on any EIP-1559 chain and wait for the receipt. */
export async function ethSend(m: string, rpcUrl: string, chainId: bigint | number, to: string, weiValue: bigint) {
  const key = ethKey(m), call = (method: string, params: unknown[]) => jsonRpc(`EVM RPC ${rpcUrl}`, rpcUrl, method, params);
  const remoteId = BigInt(await call('eth_chainId', []));
  if (remoteId !== BigInt(chainId)) throw Error(`RPC is chain ${remoteId}, not ${chainId}.`);
  const [nonce, block, tip] = await Promise.all([call('eth_getTransactionCount', [key.address, 'pending']), call('eth_getBlockByNumber', ['latest', false]), call('eth_maxPriorityFeePerGas', []).catch(() => '0x3b9aca00')]);
  const prio = BigInt(tip), baseFee = BigInt(block.baseFeePerGas ?? 0);
  const gas = BigInt(await call('eth_estimateGas', [{ from: key.address, to, value: '0x' + weiValue.toString(16) }]));
  const tx: Eip1559 = { chainId: BigInt(chainId), nonce: BigInt(nonce), maxPriorityFeePerGas: prio, maxFeePerGas: baseFee * 2n + prio, gas, to, value: weiValue };
  const signed = signEip1559(tx, key.privateKey);
  const hash = await call('eth_sendRawTransaction', [signed.raw]);
  if (hash.toLowerCase() !== signed.hash) throw Error(`RPC returned tx hash ${hash}, expected ${signed.hash}`);
  for (let i = 0; i < 120; i++) {
    const receipt = await call('eth_getTransactionReceipt', [hash]);
    if (receipt) { if (receipt.status !== '0x1') throw Error(`EVM tx ${hash} reverted.`); return { hash, from: key.address, receipt }; }
    await new Promise(r => setTimeout(r, 1000));
  }
  throw Error(`EVM tx ${hash} has no receipt after 120s.`);
}
