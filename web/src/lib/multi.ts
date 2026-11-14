// Every chain the wallet's 12 words open, with live balances. Addresses come from the user's own phrase
// (or, in the read-only demo, from the public demo-wallet.json); balances come from public testnet APIs.
import { useEffect, useRef, useState } from 'react';
import { deriveAll, type ChainAccount } from '../../../sdk/hd.ts';
import { balanceOf, type BalanceResult } from '../../../sdk/multichain.ts';
import { useWallet } from './store.tsx';

export type ChainRow = Omit<ChainAccount, 'explorer'> & { explorer: string; logo: string; status: 'base' | 'bridge-in' | 'bridge-out' | 'address'; statusLabel: string };

export const LOGO: Record<string, string> = {
  near: '/chains/near.svg', bitcoin: '/chains/bitcoin.svg', ethereum: '/chains/ethereum.svg', base: '/chains/base.svg', arbitrum: '/chains/arbitrum.svg',
  avalanche: '/chains/avalanche.svg', solana: '/chains/solana.svg', cosmos: '/chains/cosmos.svg', zcash: '/chains/zcash.svg', litecoin: '/chains/litecoin.svg',
  dogecoin: '/chains/dogecoin.svg', usdt: '/chains/usdt.svg', usdc: '/chains/usdc.svg', polygon: '/chains/polygon.svg', optimism: '/chains/optimism.svg',
  bnb: '/chains/bnb.svg', tron: '/chains/tron.svg', xrp: '/chains/xrp.svg', aptos: '/chains/aptos.svg', sui: '/chains/sui.svg', stellar: '/chains/stellar.svg', ton: '/chains/ton.svg',
};
const STATUS: Record<string, [ChainRow['status'], string]> = {
  near: ['base', 'Quantum-safe base'], bitcoin: ['bridge-in', 'Bridge in · live'], zcash: ['bridge-in', 'Bridge in · live'],
  solana: ['bridge-out', 'Bridge out · live'], ethereum: ['bridge-out', 'Bridge out'], base: ['bridge-out', 'Bridge out'], arbitrum: ['bridge-out', 'Bridge out'], avalanche: ['bridge-out', 'Bridge out'],
};
const EXPLORER: Record<string, (a: string) => string> = {
  near: a => `https://testnet.nearblocks.io/address/${a}`, bitcoin: a => `https://blockstream.info/testnet/address/${a}`,
  ethereum: a => `https://sepolia.etherscan.io/address/${a}`, base: a => `https://sepolia.basescan.org/address/${a}`, arbitrum: a => `https://sepolia.arbiscan.io/address/${a}`,
  avalanche: a => `https://testnet.snowtrace.io/address/${a}`, solana: a => `https://explorer.solana.com/address/${a}?cluster=devnet`,
  cosmos: a => `https://explorer.polypore.xyz/provider/account/${a}`, zcash: a => `https://testnet.zcashexplorer.app/address/${a}`,
  litecoin: a => `https://litecoinspace.org/testnet/address/${a}`, dogecoin: a => `https://doge-testnet-explorer.qed.me/address/${a}`,
};
const NETWORK: Record<string, string> = { bitcoin: 'testnet3', ethereum: 'Sepolia', base: 'Base Sepolia', arbitrum: 'Arbitrum Sepolia', avalanche: 'Fuji', solana: 'devnet', cosmos: 'ICS testnet', zcash: 'testnet', litecoin: 'testnet', dogecoin: 'testnet', near: 'testnet' };

function decorate(c: Omit<ChainAccount, 'explorer'>, nearAccount: string): ChainRow {
  const address = c.id === 'near' ? nearAccount : c.address;
  const [status, statusLabel] = STATUS[c.id] ?? ['address', 'Address'];
  return { ...c, address, network: NETWORK[c.id] ?? c.network, explorer: (EXPLORER[c.id] ?? (() => ''))(address), logo: LOGO[c.id] ?? '', status, statusLabel };
}

let demoCache: Promise<any> | null = null;
export const demoWallet = () => (demoCache ??= fetch('/demo-wallet.json').then(r => { if (!r.ok) throw Error('Demo wallet file missing'); return r.json(); }));

/** The chain list for the open wallet: derived from its phrase on this device, or the public demo addresses. */
export function useChains() {
  const { vault, account } = useWallet();
  const [rows, setRows] = useState<ChainRow[] | null>(null);
  const [pq, setPq] = useState<string>('');
  const [error, setError] = useState('');
  useEffect(() => {
    let live = true; setError('');
    (async () => {
      try {
        if (vault?.mnemonic) { const d = deriveAll(vault.mnemonic); if (live) { setRows(d.chains.map(({ explorer, ...c }) => decorate(c, vault.wallet))); setPq(d.pqHandle); } return; }
        if (vault) { if (live) { setRows([]); setPq(''); } return; }
        const d = await demoWallet(); if (live) { setRows(d.chains.map((c: any) => decorate(c, d.account))); setPq(d.pqHandle); }
      } catch (e: any) { if (live) setError(e.message); }
    })();
    return () => { live = false; };
  }, [vault, account]);
  return { rows, pq, error, hasSeed: !vault || !!vault.mnemonic };
}

export type Bal = { state: 'loading' } | { state: 'ok'; value: number; symbol: string; raw: string; decimals: number } | { state: 'none'; reason: string } | { state: 'error'; reason: string };
const cache = new Map<string, { at: number; v: Bal }>();
/** Live balances, polled every 30 s, cached 20 s across screens. */
export function useBalances(rows: ChainRow[] | null) {
  const [map, setMap] = useState<Record<string, Bal>>({});
  const key = rows?.map(r => r.id + r.address).join('|') ?? '';
  const tick = useRef(0);
  useEffect(() => {
    if (!rows?.length) return;
    let live = true;
    const load = async () => {
      const n = ++tick.current;
      await Promise.all(rows.map(async r => {
        const k = r.id + ':' + r.address; const hit = cache.get(k);
        if (hit && Date.now() - hit.at < 20000) { if (live) setMap(m => ({ ...m, [r.id]: hit.v })); return; }
        let v: Bal;
        try {
          const b: BalanceResult = await balanceOf(r.id, r.address);
          v = 'unsupported' in b ? { state: 'none', reason: b.unsupported } : { state: 'ok', value: Number(BigInt(b.amount)) / 10 ** b.decimals, raw: b.amount, decimals: b.decimals, symbol: b.symbol };
        } catch (e: any) { v = { state: 'error', reason: String(e.message ?? e).slice(0, 120) }; }
        cache.set(k, { at: Date.now(), v }); if (live && n === tick.current) setMap(m => ({ ...m, [r.id]: v }));
      }));
    };
    load(); const t = setInterval(load, 30000);
    return () => { live = false; clearInterval(t); };
  }, [key]);
  return map;
}

export const fmt = (v: number, max = 4) => v === 0 ? '0' : v < 0.0001 ? '<0.0001' : v.toLocaleString('en-US', { maximumFractionDigits: max });
export const shortAddr = (a: string, n = 6) => a.length > n * 2 + 3 ? `${a.slice(0, n)}…${a.slice(-n + 1)}` : a;
