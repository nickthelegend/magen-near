import { useEffect, useState } from 'react';
import { ArrowDown, Info, ShieldAlert, ShieldCheck, Repeat, KeyRound, Atom } from 'lucide-react';
import { useWallet, feeSigner } from '../lib/store.tsx';
import { friendlyError, near } from '../lib/chain.ts';
import { nearAmount } from '../../../sdk/index.ts';
import { PAIRS, refQuote, refPool, swapNearFor, ftBalance, type Pair } from '../../../sdk/swap.ts';
import { intentsQuote, INTENT_ROUTES } from '../../../sdk/phase2.ts';
import { ReadOnlyBar, Spinner, TxLink } from '../ui/bits.tsx';
import { ChainLogo } from '../ui/chain.tsx';
import { fmt, useChains } from '../lib/multi.ts';

const f24 = (v: bigint) => fmt(Number(v / 10n ** 16n) / 1e8, 4);

export function Swap() {
  const [tab, setTab] = useState<'ref' | 'intents'>('ref');
  return <>
    <ReadOnlyBar />
    <h1 className="page-title-m only-m">Swap</h1>
    <div><div className="segs"><button className={tab === 'ref' ? 'on' : ''} onClick={() => setTab('ref')}>Swap on NEAR</button><button className={tab === 'intents' ? 'on' : ''} onClick={() => setTab('intents')}>Cross-chain quote</button></div></div>
    {tab === 'ref' ? <RefSwap /> : <IntentsQuote />}
  </>;
}

function RefSwap() {
  const { vault, account, live, refresh, readOnly } = useWallet();
  const [pair, setPair] = useState<Pair>(PAIRS[0]);
  const [amt, setAmt] = useState('1');
  const [quote, setQuote] = useState<bigint | null>(null);
  const [pool, setPool] = useState<Awaited<ReturnType<typeof refPool>> | null>(null);
  const [bal, setBal] = useState<bigint | null>(null);
  const [busy, setBusy] = useState(''); const [err, setErr] = useState('');
  const [res, setRes] = useState<{ hash: string; success: boolean; error: string; received: bigint } | null>(null);
  let amountIn = 0n; try { amountIn = amt ? BigInt(nearAmount(amt)) : 0n; } catch { /* invalid input */ }
  useEffect(() => { let on = true; setQuote(null); const t = setTimeout(() => refQuote(pair, amountIn).then(q => on && setQuote(q)).catch(e => on && setErr(e.message)), 250); return () => { on = false; clearTimeout(t); }; }, [pair, amt]);
  useEffect(() => { let on = true; const load = () => { refPool(pair).then(p => on && setPool(p)).catch(() => {}); ftBalance(pair.token, account).then(b => on && setBal(b)).catch(() => on && setBal(0n)); }; load(); const i = setInterval(load, 15000); return () => { on = false; clearInterval(i); }; }, [pair, account, res]);
  const rate = quote && amountIn > 0n ? Number(quote * 10000n / amountIn) / 10000 : null;
  const spot = pool ? Number(pool.other * 10000n / pool.near) / 10000 : null;
  const impact = rate && spot ? Math.max(0, (1 - rate / spot) * 100) : null;
  const go = async () => {
    if (!vault) return; setErr(''); setRes(null);
    try {
      if (amountIn <= 0n) throw Error('Enter an amount above zero.');
      if (live?.account && amountIn + 5n * 10n ** 23n > live.account.amount) throw Error('Not enough NEAR. The wallet keeps 0.5 NEAR for storage.');
      setBusy('Signing with both keys…');
      const r = await swapNearFor(feeSigner(vault, live), vault.wallet, vault.keys, pair, amountIn);
      setRes(r); refresh();
    } catch (e: any) { setErr(friendlyError(String(e.message))); } finally { setBusy(''); }
  };
  return <div className="flow">
    <section className="card flow-main rise">
      <div className="field"><span>You pay</span>
        <div className="amount-in"><input inputMode="decimal" value={amt} onChange={e => { setAmt(e.target.value.replace(/[^\d.]/g, '')); setRes(null); }} aria-label="Amount in NEAR" /><span style={{ display: 'flex', gap: 8, alignItems: 'center', color: 'var(--text)' }}><ChainLogo id="near" size="sm" />NEAR</span></div>
        <div className="amount-meta"><span>Balance {live?.account ? near(live.account.amount, 4) : '…'} NEAR</span></div></div>
      <div style={{ display: 'grid', placeItems: 'center', margin: '-8px 0' }}><span className="lock-ico" style={{ borderRadius: '50%' }}><ArrowDown size={17} /></span></div>
      <div className="field"><span>You get</span>
        <div className="amount-in"><span className="num" style={{ flex: 1, fontFamily: 'var(--display)', fontSize: 40, fontWeight: 600, letterSpacing: '-.04em', color: quote ? 'var(--text)' : 'var(--text-3)' }}>{quote === null ? '…' : f24(quote)}</span>
          <select className="input" style={{ width: 130, height: 42 }} value={pair.id} onChange={e => { setPair(PAIRS.find(p => p.id === e.target.value)!); setRes(null); }} aria-label="Token to receive">{PAIRS.map(p => <option key={p.id} value={p.id}>{p.symbol}</option>)}</select></div>
        <div className="amount-meta"><span>You hold {bal === null ? '…' : f24(bal)} {pair.symbol}</span><span>{pair.label}</span></div></div>
      <div className="summary">
        <div><span>Rate</span><b>{rate ? `1 NEAR = ${fmt(rate, 4)} ${pair.symbol}` : '…'}</b></div>
        <div><span>Pool</span><b>Ref Finance #{pair.pool} · {pool ? `${fmt(Number(pool.near / 10n ** 24n), 0)} NEAR deep` : '…'}</b></div>
        <div><span>Price impact</span><b>{impact === null ? '…' : `${impact.toFixed(2)}%`}</b></div>
        <div><span>Minimum received</span><b>{quote ? `${f24(quote * 99n / 100n)} ${pair.symbol}` : '…'} (1% slippage)</b></div>
      </div>
      {err && <div className="banner banner-red"><ShieldAlert size={18} /><div>{err}</div></div>}
      {res && (res.success
        ? <div className="result ok"><h3><ShieldCheck size={22} color="var(--mint)" />Swapped. Both signatures checked on NEAR.</h3><p>Received {f24(res.received)} {pair.symbol}. Four calls ran under one dual-signed approval.</p><TxLink hash={res.hash} label="View on explorer" /></div>
        : <div className="result bad"><h3><ShieldAlert size={22} color="var(--red)" />{friendlyError(res.error)}</h3><TxLink hash={res.hash} label="View the transaction" /></div>)}
      {readOnly ? <a className="btn btn-primary btn-lg btn-block" href="#/start">Create a wallet to swap</a>
        : <button className="btn btn-primary btn-lg btn-block" onClick={go} disabled={!!busy || !quote}>{busy ? <><Spinner />{busy}</> : <><Repeat size={18} />Swap · signed twice</>}</button>}
    </section>
    <aside className="card">
      <div className="card-head"><h2>One approval, four calls</h2></div>
      <div className="steps" style={{ marginTop: 8 }}>
        {['Register on wNEAR', 'Wrap NEAR', `Register on ${pair.symbol}`, 'Swap on Ref Finance'].map((s, i) => <div key={s} className="step"><span className="mono" style={{ color: 'var(--mint)' }}>{i + 1}</span>{s}</div>)}
      </div>
      <div className="sigs" style={{ marginTop: 14 }}>
        <div className="sig"><span className="lock-ico"><KeyRound size={17} /></span><span><b>ed25519</b><small>classical</small></span></div>
        <div className="sig"><span className="lock-ico pq"><Atom size={17} /></span><span><b>ML-DSA-65</b><small>quantum-safe</small></span></div>
      </div>
      <p className="hint" style={{ marginTop: 12 }}>Real swap on NEAR testnet against a live Ref pool. The output tokens are testnet tokens, not real dollars.</p>
    </aside>
  </div>;
}

function IntentsQuote() {
  const { rows } = useChains();
  const [from, setFrom] = useState('wNEAR'); const [to, setTo] = useState('ZEC'); const [amt, setAmt] = useState('10');
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const [q, setQ] = useState<Awaited<ReturnType<typeof intentsQuote>> | null>(null);
  const recipientFor = (sym: string) => {
    const route = INTENT_ROUTES.find(r => r.symbol === sym)!;
    if (route.recipientType === 'INTENTS') return 'near';
    const id = sym === 'SOL' ? 'solana' : sym === 'ETH' ? 'ethereum' : 'bitcoin';
    const a = rows?.find(x => x.id === id)?.address ?? '';
    return id === 'bitcoin' ? a.replace(/^tb1/, 'bc1') : a;
  };
  const quote = async () => {
    setErr(''); setQ(null); setBusy(true);
    try { if (from === to) throw Error('Pick two different assets.'); setQ(await intentsQuote(from, to, amt, recipientFor(to))); }
    catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };
  const Pick = ({ v, set }: { v: string; set: (s: string) => void }) => <select className="input" value={v} onChange={e => { set(e.target.value); setQ(null); }} style={{ width: 170 }}>
    {INTENT_ROUTES.map(r => <option key={r.symbol} value={r.symbol}>{r.label}</option>)}</select>;
  return <div className="flow">
    <section className="card flow-main rise">
      <div className="banner"><Info size={18} /><div><strong>Mainnet quote</strong>Live prices from NEAR Intents. Intents has no testnet, so this is a quote only.</div></div>
      <div className="field"><span>You pay</span><div style={{ display: 'flex', gap: 10 }}><div className="amount-in" style={{ flex: 1, padding: '10px 16px' }}><input inputMode="decimal" value={amt} onChange={e => { setAmt(e.target.value.replace(/[^\d.]/g, '')); setQ(null); }} aria-label="Amount" style={{ fontSize: 30 }} /></div><Pick v={from} set={setFrom} /></div></div>
      <div className="field"><span>You get</span><div style={{ display: 'flex', gap: 10 }}><div className="amount-in" style={{ flex: 1, padding: '10px 16px' }}><span className="num" style={{ fontSize: 30, fontFamily: 'var(--display)', fontWeight: 600, color: q ? 'var(--text)' : 'var(--text-3)' }}>{q ? q.amountOut : '—'}</span></div><Pick v={to} set={setTo} /></div></div>
      {err && <div className="banner banner-red"><ShieldAlert size={18} /><div>{err}</div></div>}
      <button className="btn btn-light btn-lg btn-block" onClick={quote} disabled={busy || !amt}>{busy ? <><Spinner />Asking NEAR Intents…</> : 'Get a mainnet quote'}</button>
    </section>
    <aside className="card">
      <div className="card-head"><h2>Quote</h2><span className="pill">mainnet · dry run</span></div>
      <div className="kv" style={{ marginTop: 6 }}>
        <div><span>Pay</span><b>{q ? `${q.amountIn} ${q.from.symbol}` : '—'}</b></div>
        <div><span>Receive</span><b>{q ? `${q.amountOut} ${q.to.symbol}` : '—'}</b></div>
        <div><span>Value</span><b>{q ? `$${Number(q.usdIn).toFixed(2)} → $${Number(q.usdOut).toFixed(2)}` : '—'}</b></div>
        <div><span>Time</span><b>{q ? `about ${q.seconds} s` : '—'}</b></div>
      </div>
    </aside>
  </div>;
}
