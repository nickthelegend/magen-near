import { useState } from 'react';
import { Repeat, ArrowDown, Info, ShieldAlert } from 'lucide-react';
import { useWallet } from '../lib/store.tsx';
import { intentsQuote, INTENT_ROUTES, chainAddresses } from '../../../sdk/phase2.ts';
import { ReadOnlyBar, Spinner, useAsync } from '../ui/bits.tsx';

const LABEL: Record<string, string> = Object.fromEntries(INTENT_ROUTES.map(r => [r.symbol, r.label]));

export function Swap() {
  const { account } = useWallet();
  const [from, setFrom] = useState('wNEAR'); const [to, setTo] = useState('ZEC'); const [amt, setAmt] = useState('10');
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const [q, setQ] = useState<Awaited<ReturnType<typeof intentsQuote>> | null>(null);
  const addrs = useAsync(() => chainAddresses(account), [account]);
  const recipientFor = (sym: string) => {
    const route = INTENT_ROUTES.find(r => r.symbol === sym)!;
    if (route.recipientType === 'INTENTS') return 'near';
    const id = sym === 'SOL' ? 'solana' : sym === 'ETH' ? 'ethereum' : 'bitcoin';
    const a = addrs.data?.find(x => x.id === id)?.address ?? '';
    return id === 'bitcoin' ? a.replace(/^tb1/, 'bc1') : a;
  };
  const quote = async () => {
    setErr(''); setQ(null); setBusy(true);
    try { if (from === to) throw Error('Pick two different assets.'); setQ(await intentsQuote(from, to, amt, recipientFor(to))); }
    catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };
  const Pick = ({ v, set }: { v: string; set: (s: string) => void }) => <select className="input" value={v} onChange={e => { set(e.target.value); setQ(null); }} style={{ width: 200 }}>
    {INTENT_ROUTES.map(r => <option key={r.symbol} value={r.symbol}>{r.label} ({r.symbol})</option>)}</select>;
  return <>
    <ReadOnlyBar />
    <h1 className="page-title-m only-m">Swap & bridge</h1>
    <div className="flow">
      <section className="card flow-main rise">
        <div className="banner banner-gray"><Info size={18} /><div><strong>Quote only — mainnet funding required.</strong>Live prices from NEAR Intents (1Click). Intents runs on mainnet only, so Magen’s testnet wallet can quote but not execute.</div></div>
        <div className="field"><span>You pay</span><div style={{ display: 'flex', gap: 10 }}><div className="amount-in" style={{ flex: 1, padding: '10px 16px' }}><input inputMode="decimal" value={amt} onChange={e => { setAmt(e.target.value.replace(/[^\d.]/g, '')); setQ(null); }} aria-label="Amount" style={{ fontSize: 32 }} /></div><Pick v={from} set={setFrom} /></div></div>
        <div style={{ display: 'grid', placeItems: 'center' }}><button className="btn btn-light btn-sm" onClick={() => { setFrom(to); setTo(from); setQ(null); }} aria-label="Swap direction"><ArrowDown size={16} /></button></div>
        <div className="field"><span>You get</span><div style={{ display: 'flex', gap: 10 }}><div className="amount-in" style={{ flex: 1, padding: '10px 16px' }}><span style={{ fontSize: 32, fontWeight: 650, color: q ? 'var(--text)' : 'var(--text-3)' }}>{q ? q.amountOut : '—'}</span></div><Pick v={to} set={setTo} /></div>
          <span className="hint">{INTENT_ROUTES.find(r => r.symbol === to)!.recipientType === 'INTENTS' ? `${LABEL[to]} is delivered into NEAR Intents.` : `To your Magen ${LABEL[to]} address (Chain Signatures).`}</span></div>
        {err && <div className="banner banner-red"><ShieldAlert size={18} /><div>{err}</div></div>}
        <button className="btn btn-primary btn-lg btn-block" onClick={quote} disabled={busy || !amt}>{busy ? <><Spinner />Asking NEAR Intents…</> : <><Repeat size={18} />Get a live quote</>}</button>
      </section>
      <aside className="card">
        <div className="card-head"><h2>Quote</h2><span className="card-sub">dry run</span></div>
        <div className="kv" style={{ marginTop: 10 }}>
          <div><span>Pay</span><b>{q ? `${q.amountIn} ${q.from.symbol}` : '—'}</b></div>
          <div><span>Receive</span><b>{q ? `${q.amountOut} ${q.to.symbol}` : '—'}</b></div>
          <div><span>Value</span><b>{q ? `$${Number(q.usdIn).toFixed(2)} → $${Number(q.usdOut).toFixed(2)}` : '—'}</b></div>
          <div><span>Time</span><b>{q ? `about ${q.seconds} s` : '—'}</b></div>
          <div><span>Status</span><b>{q ? q.status : 'No quote yet'}</b></div>
        </div>
        <p className="hint" style={{ padding: '14px 24px 22px' }}>Cosmos (ATOM) is not in 1Click’s token list, so it isn’t offered. Zcash routes deliver ZEC into NEAR Intents; sending to a Zcash address needs mainnet.</p>
      </aside>
    </div>
  </>;
}
