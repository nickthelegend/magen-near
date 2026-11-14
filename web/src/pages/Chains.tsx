import { useState } from 'react';
import { Atom, ExternalLink, QrCode as QrIcon, ArrowDownToLine, ArrowUpFromLine, Info } from 'lucide-react';
import { ReadOnlyBar, CopyBtn } from '../ui/bits.tsx';
import { ChainLogo } from '../ui/chain.tsx';
import { ReceiveModal } from '../ui/Qr.tsx';
import { useBalances, useChains, fmt, shortAddr, type ChainRow } from '../lib/multi.ts';

export function Chains() {
  const { rows, pq, error, hasSeed } = useChains();
  const bals = useBalances(rows);
  const [open, setOpen] = useState<ChainRow | null>(null);
  return <>
    <ReadOnlyBar />
    <h1 className="page-title-m only-m">All chains</h1>
    {pq && <section className="pqcard rise"><span className="lock-ico pq" style={{ width: 46, height: 46 }}><Atom size={22} /></span>
      <span style={{ minWidth: 0 }}><b>Your quantum-safe key</b><small>ML-DSA-65, made from the same 12 words. It signs every move out of NEAR.</small><div className="mono" style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4, overflowWrap: 'anywhere' }}>{pq}</div></span>
      <span className="pill pill-green">Same seed</span></section>}
    {error && <div className="banner banner-red"><Info size={18} /><div>{error}</div></div>}
    {!hasSeed && <div className="banner"><Info size={18} /><div><strong>No recovery phrase in this wallet</strong>It was upgraded from an older NEAR account. Create a new wallet to get an address on every chain.</div></div>}
    <div className="chain-grid">
      {(rows ?? []).map((r, i) => { const b = bals[r.id]; return <article key={r.id} className="chain-card rise" style={{ animationDelay: `${i * 40}ms` }}>
        <div className="top-row"><ChainLogo id={r.id} /><span><b>{r.name}</b><small>{r.network} · {r.scheme}</small></span>
          <span className={`pill ${r.status === 'address' ? '' : 'pill-green'}`}>{r.statusLabel}</span></div>
        <div className="bal num">{!b || b.state === 'loading' ? <span className="skel" style={{ display: 'inline-block', width: 90, height: 24 }} /> : b.state === 'ok' ? <>{fmt(b.value, 6)}<small>{b.symbol}</small></> : <span style={{ fontSize: 14, color: 'var(--text-3)', fontFamily: 'var(--ui)', fontWeight: 500 }}>{b.state === 'none' ? 'Balance not readable on testnet' : 'Explorer did not answer'}</span>}</div>
        <div className="addrline"><span>{r.id === 'near' ? r.address : shortAddr(r.address, 10)}</span><CopyBtn text={r.address} label={`Copy ${r.name} address`} /><a href={r.explorer} target="_blank" rel="noreferrer" aria-label="Explorer"><ExternalLink size={15} /></a></div>
        <div className="foot">
          <button className="btn btn-light btn-sm" onClick={() => setOpen(r)}><QrIcon size={15} />Receive</button>
          {r.status === 'bridge-in' && <a className="btn btn-light btn-sm" href={`#/app/bridge/in/${r.id === 'bitcoin' ? 'btc' : 'zcash'}`}><ArrowDownToLine size={15} />Bridge to NEAR</a>}
          {r.status === 'bridge-out' && <a className="btn btn-light btn-sm" href={`#/app/bridge/out/${r.id}`}><ArrowUpFromLine size={15} />Bridge from NEAR</a>}
        </div>
      </article>; })}
    </div>
    <p className="hint">Addresses use standard paths (BIP-44/84, SLIP-10), so any wallet can restore them from your 12 words. On their own chains these keys stay classical; moving coins to NEAR puts them under your quantum-safe lock.</p>
    {open && <ReceiveModal chain={{ ...open, note: open.status === 'bridge-in' ? `This is your ${open.name} address. To bring ${open.symbol} to NEAR, use Bridge instead.` : undefined }} onClose={() => setOpen(null)} />}
  </>;
}
