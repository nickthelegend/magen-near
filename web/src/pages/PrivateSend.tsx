import { useState } from 'react';
import { EyeOff, Eye, ShieldCheck, ShieldAlert, Copy, Check, KeyRound } from 'lucide-react';
import { useWallet, feeSigner } from '../lib/store.tsx';
import { friendlyError, near, readAccount, short, txUrl } from '../lib/chain.ts';
import { execute, makeIntent, nearAmount, signIntent, view } from '../../../sdk/index.ts';
import { metaKey, newStealthPayment, openStealthNote, sweep } from '../../../sdk/stealth.ts';
import { ReadOnlyBar, Spinner, TxLink, useAsync } from '../ui/bits.tsx';

function Copyable({ text }: { text: string }) {
  const [ok, setOk] = useState(false);
  return <div className="addr" style={{ fontSize: 13 }}><span className="mono" style={{ overflowWrap: 'anywhere' }}>{text}</span>
    <button aria-label="Copy" onClick={() => navigator.clipboard?.writeText(text).then(() => { setOk(true); setTimeout(() => setOk(false), 1200); })}>{ok ? <Check size={16} /> : <Copy size={16} />}</button></div>;
}

export function PrivateSend() {
  const { vault, live, refresh } = useWallet();
  const [tab, setTab] = useState<'send' | 'receive'>('send');
  const [meta, setMeta] = useState(''); const [amt, setAmt] = useState('0.1');
  const [busy, setBusy] = useState(''); const [err, setErr] = useState('');
  const [sent, setSent] = useState<{ hash: string; success: boolean; error: string; account: string; note: string } | null>(null);
  const [note, setNote] = useState(''); const [opened, setOpened] = useState<{ account: string; seed: string; balance: bigint | null } | null>(null);
  const [dest, setDest] = useState(''); const [swept, setSwept] = useState<{ hash: string; ok: boolean } | null>(null);
  const rec = useAsync(() => fetch('/private-live.json').then(r => r.json()), []);

  const send = async () => {
    if (!vault) return; setErr(''); setSent(null);
    try {
      const pay = newStealthPayment(meta);
      setBusy('Signing twice; NEAR checks both…');
      const s = await view(vault.wallet);
      const r = await execute(feeSigner(vault, live), vault.wallet, signIntent(makeIntent(vault.wallet, s.nonce, { kind: 'send', receiver: pay.account, amount: nearAmount(amt) }), vault.keys));
      setSent({ ...r, ...pay }); refresh();
    } catch (e: any) { setErr(friendlyError(String(e.message))); } finally { setBusy(''); }
  };
  const open = async () => {
    if (!vault) return; setErr(''); setOpened(null); setSwept(null);
    try { const o = openStealthNote(vault.keys, note); const a = await readAccount(o.account); setOpened({ ...o, balance: a?.amount ?? null }); }
    catch (e: any) { setErr(e.message); }
  };
  const spend = async () => {
    if (!opened) return; setErr('');
    try {
      if (!(await readAccount(dest.trim()))) throw Error('That destination does not exist on NEAR testnet.');
      setBusy('Spending from the one-time account…');
      const r = await sweep(opened, dest.trim());
      setSwept({ hash: r.transaction.hash, ok: !!(r.status && 'SuccessValue' in r.status) });
    } catch (e: any) { setErr(friendlyError(String(e.message))); } finally { setBusy(''); }
  };
  const d = rec.data;
  return <>
    <ReadOnlyBar />
    <h1 className="page-title-m only-m">Private send</h1>
    <section className="card card-pad rise" style={{ display: 'grid', gap: 12 }}>
      <h2 style={{ fontSize: 24, fontWeight: 650, letterSpacing: '-.02em' }}>Pay someone without linking it to their account.</h2>
      <div className="beforeafter">
        <div><b style={{ display: 'flex', gap: 6, alignItems: 'center' }}><EyeOff size={15} />Hidden</b>Which account the payment really belongs to. It lands in a one-time account only the recipient can open.</div>
        <div><b style={{ display: 'flex', gap: 6, alignItems: 'center' }}><Eye size={15} />Still public</b>Your account, the amount and the time. Sweeping the one-time account into the recipient’s main account links them again.</div>
      </div>
    </section>
    <div className="segs" style={{ maxWidth: 360 }}><button className={tab === 'send' ? 'on' : ''} onClick={() => setTab('send')}>Send privately</button><button className={tab === 'receive' ? 'on' : ''} onClick={() => setTab('receive')}>Receive privately</button></div>
    <div className="grid2">
      {tab === 'send' ? <section className="card card-pad rise" style={{ display: 'grid', gap: 14, alignContent: 'start' }}>
        <label className="field"><span>Recipient’s Magen meta-key</span><input className="input mono" placeholder="magen-meta:…" value={meta} onChange={e => setMeta(e.target.value)} spellCheck={false} /></label>
        <label className="field"><span>Amount (NEAR)</span><input className="input" inputMode="decimal" value={amt} onChange={e => setAmt(e.target.value.replace(/[^\d.]/g, ''))} /></label>
        {vault ? <button className="btn btn-primary" onClick={send} disabled={!meta || !!busy}>{busy ? <><Spinner />{busy}</> : <><ShieldCheck size={17} />Sign twice and send privately</>}</button> : <a className="btn btn-dark" href="#/start">Unlock to send</a>}
        {sent && (sent.success ? <div className="result ok"><h3><ShieldCheck size={20} color="var(--green)" />Sent to a one-time account.</h3>
          <p>Give the recipient this note (message, QR, anywhere). Only their wallet can open it.</p><Copyable text={sent.note} />
          <p className="mono" style={{ fontSize: 12 }}>One-time account {short(sent.account, 10, 6)}</p><TxLink hash={sent.hash} label="View transaction" /></div>
          : <div className="result bad"><h3><ShieldAlert size={20} color="var(--red)" />{friendlyError(sent.error)}</h3><TxLink hash={sent.hash} /></div>)}
      </section> : <section className="card card-pad rise" style={{ display: 'grid', gap: 14, alignContent: 'start' }}>
        {vault ? <><span className="card-sub">Your meta-key (safe to publish)</span><Copyable text={metaKey(vault.keys)} />
          <label className="field"><span>Open a payment note</span><input className="input mono" placeholder="magen-note:…" value={note} onChange={e => setNote(e.target.value)} spellCheck={false} /></label>
          <button className="btn btn-dark" onClick={open} disabled={!note}><KeyRound size={17} />Open note</button>
          {opened && <div className="banner banner-blue"><div><strong>One-time account {short(opened.account, 10, 6)}</strong>{opened.balance === null ? 'Empty or already spent.' : `Holds ${near(opened.balance, 4)} NEAR. Only you can derive its key.`}</div></div>}
          {opened?.balance != null && <><label className="field"><span>Spend it to</span><input className="input" placeholder="any NEAR account" value={dest} onChange={e => setDest(e.target.value)} /><span className="hint">Spending to your own main account links the two again.</span></label>
            <button className="btn btn-primary" onClick={spend} disabled={!dest || !!busy}>{busy ? <><Spinner />{busy}</> : 'Spend from the one-time account'}</button></>}
          {swept && <div className={`result ${swept.ok ? 'ok' : 'bad'}`}><h3>{swept.ok ? 'Spent.' : 'Failed.'}</h3><TxLink hash={swept.hash} /></div>}</>
          : <a className="btn btn-dark" href="#/start">Unlock to see your meta-key</a>}
      </section>}
      <section className="card card-pad rise" style={{ display: 'grid', gap: 10, alignContent: 'start' }}>
        <h2 style={{ fontSize: 17, fontWeight: 600 }}>Recorded live run</h2>
        {d ? <>
          <div className="act-row" style={{ padding: '10px 0' }}><span className="act-ic sent"><ShieldCheck size={18} /></span><span><b>0.1 NEAR to a one-time account</b><small>from {d.sender}, signed twice</small></span><a className="link" href={txUrl(d.send_signed_twice.hash)} target="_blank" rel="noreferrer">{short(d.send_signed_twice.hash)}</a></div>
          <div className="act-row" style={{ padding: '10px 0' }}><span className="act-ic received"><KeyRound size={18} /></span><span><b>Recipient opened the note and spent it</b><small>one-time {short(d.one_time_account, 8, 6)} → {d.recipient_spends_from_one_time_account.to}</small></span><a className="link" href={txUrl(d.recipient_spends_from_one_time_account.hash)} target="_blank" rel="noreferrer">{short(d.recipient_spends_from_one_time_account.hash)}</a></div>
          <p className="hint">On chain, nothing points from the one-time account to the recipient’s main account ({short(d.recipient_main, 14, 8)}).</p>
        </> : <div className="skel" style={{ height: 100 }} />}
      </section>
    </div>
  </>;
}
