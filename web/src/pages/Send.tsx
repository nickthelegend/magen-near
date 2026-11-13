import { useState } from 'react';
import { ArrowLeft, KeyRound, Atom, Check, ShieldAlert, ShieldCheck, ArrowRight } from 'lucide-react';
import { useWallet } from '../lib/store.tsx';
import { friendlyError, near, readAccount, readActivity, short } from '../lib/chain.ts';
import { execute, makeIntent, nearAmount, signIntent, view } from '../../../sdk/index.ts';
import { ReadOnlyBar, Spinner, TxLink, useAsync } from '../ui/bits.tsx';

type Stage = 'form' | 'review' | 'sending' | 'done';
const RESERVE = 5n * 10n ** 23n;

export function Send() {
  const { vault, account, live, refresh, readOnly } = useWallet();
  const [to, setTo] = useState(''); const [amt, setAmt] = useState('');
  const [stage, setStage] = useState<Stage>('form'); const [err, setErr] = useState(''); const [busy, setBusy] = useState('');
  const [dropPq, setDropPq] = useState(false);
  const [sig, setSig] = useState<{ ed?: number; pq?: number; intent?: string }>({});
  const [res, setRes] = useState<{ hash: string; success: boolean; error: string } | null>(null);
  const recent = useAsync(() => readActivity(account, 20).then(a => [...new Set(a.filter(x => x.kind === 'sent' && x.counterparty).map(x => x.counterparty!))].slice(0, 4)), [account]);
  const spendable = live?.account ? live.account.amount - BigInt(live.account.storage) * 10n ** 19n - RESERVE : 0n;
  const max = spendable > 10n ** 22n ? spendable - 10n ** 22n : 0n;

  const review = async () => {
    setErr('');
    try {
      const id = to.trim().toLowerCase();
      if (!/^(([a-z\d]+[-_])*[a-z\d]+\.)*([a-z\d]+[-_])*[a-z\d]+$/.test(id) || id.length < 2 || id.length > 64) throw Error('Enter a NEAR account like bob.testnet.');
      if (id === account) throw Error('That is this wallet. Choose another account.');
      const y = BigInt(nearAmount(amt.trim()));
      if (y <= 0n) throw Error('Enter an amount above zero.');
      if (live?.account && y > spendable) throw Error(`You can send up to ${near(spendable, 4)} NEAR. The wallet keeps 0.5 NEAR plus storage.`);
      setBusy('Checking the recipient…');
      if (!(await readAccount(id))) throw Error(`${id} does not exist on NEAR testnet.`);
      setTo(id); setStage('review');
    } catch (e: any) { setErr(e.message); } finally { setBusy(''); }
  };
  const send = async () => {
    if (!vault) return;
    setStage('sending'); setErr(''); setRes(null); setSig({});
    try {
      setBusy('Reading the wallet’s nonce from NEAR…');
      const s = await view(vault.wallet);
      const intent = makeIntent(vault.wallet, s.nonce, { kind: 'send', receiver: to, amount: nearAmount(amt.trim()) });
      setBusy('Signing with both keys on this device…');
      await new Promise(r => setTimeout(r, 30));
      const signed = signIntent(intent, vault.keys);
      setSig({ ed: 64, pq: dropPq ? 0 : 3309, intent });
      setBusy('Sending to NEAR. The contract checks both signatures…');
      const r = await execute(vault.relay, vault.wallet, dropPq ? { ...signed, pq_sig: '' } : signed);
      setRes(r); setStage('done'); refresh();
    } catch (e: any) { setErr(friendlyError(String(e.message))); setStage('review'); } finally { setBusy(''); }
  };

  return <>
    <ReadOnlyBar />
    <h1 className="page-title-m only-m">Send</h1>
    <div className="flow">
      <section className="card flow-main rise">
        {stage === 'form' && <>
          <label className="field"><span>To</span><input className="input" placeholder="Account, like bob.testnet" value={to} onChange={e => setTo(e.target.value)} autoCapitalize="off" spellCheck={false} /></label>
          {!!recent.data?.length && <div className="contacts">{recent.data.map(c => <button key={c} className="contact" onClick={() => setTo(c)}><i>{c[0].toUpperCase()}</i><span>{short(c, 18, 8)}</span></button>)}</div>}
          <div className="field"><span>Amount</span>
            <div className="amount-in"><input inputMode="decimal" placeholder="0" value={amt} onChange={e => setAmt(e.target.value.replace(/[^\d.]/g, ''))} aria-label="Amount in NEAR" /><span>NEAR</span></div>
            <div className="amount-meta"><span>Available {live?.account ? near(spendable > 0n ? spendable : 0n, 4) : '…'} NEAR</span>{max > 0n && <button onClick={() => setAmt((Number(max / 10n ** 20n) / 10000).toString())}>Use max</button>}</div>
          </div>
          {err && <p className="err" role="alert">{err}</p>}
          <button className="btn btn-primary btn-lg btn-block" onClick={review} disabled={!to || !amt || !!busy}>{busy ? <><Spinner />{busy}</> : <>Review <ArrowRight size={18} /></>}</button>
        </>}
        {stage !== 'form' && <>
          {stage === 'review' && <button className="backstep" onClick={() => setStage('form')}><ArrowLeft size={16} />Edit</button>}
          <div style={{ display: 'grid', gap: 6 }}><span className="card-sub">You’re sending</span><div style={{ fontSize: 44, fontWeight: 650, letterSpacing: '-.04em', lineHeight: 1 }}>{amt} <span style={{ fontSize: 20, color: 'var(--text-3)' }}>NEAR</span></div><span className="card-sub">to <b style={{ color: 'var(--text)' }}>{to}</b></span></div>
          <div className="summary">
            <div><span>From</span><b className="mono">{account}</b></div>
            <div><span>Signed together</span><b>wallet, recipient, amount, nonce, 5-minute expiry</b></div>
            <div><span>Network fee</span><b>about 0.001 NEAR</b></div>
          </div>
          <div className="toggle"><span><b>Leave out the quantum half</b><small>A test: send only the ed25519 signature and watch NEAR refuse it.</small></span>
            <button className={`switch ${dropPq ? 'on' : ''}`} role="switch" aria-checked={dropPq} aria-label="Leave out the quantum half" onClick={() => setDropPq(v => !v)} disabled={stage !== 'review'} /></div>
          {err && <div className="banner banner-red"><ShieldAlert size={18} /><div>{err}</div></div>}
          {res && (res.success
            ? <div className="result ok"><h3><ShieldCheck size={22} color="var(--green)" />Sent. Both signatures checked on chain.</h3><p>{amt} NEAR left this wallet after NEAR verified ed25519 and ML-DSA-65.</p><TxLink hash={res.hash} label="View transaction" /></div>
            : <div className="result bad"><h3><ShieldAlert size={22} color="var(--red)" />{friendlyError(res.error)}</h3><p>Nothing moved. The contract stopped the payment and NEAR recorded why.</p><TxLink hash={res.hash} label="View the refusal" /></div>)}
          {stage === 'review' && (readOnly
            ? <a className="btn btn-dark btn-lg btn-block" href="#/start">Unlock to sign</a>
            : <button className={`btn ${dropPq ? 'btn-danger' : 'btn-primary'} btn-lg btn-block`} onClick={send}>{dropPq ? 'Send with one signature (test)' : 'Sign twice and send'}</button>)}
          {stage === 'sending' && <button className="btn btn-dark btn-lg btn-block" disabled><Spinner />{busy}</button>}
          {stage === 'done' && <button className="btn btn-light btn-lg btn-block" onClick={() => { setStage('form'); setRes(null); setAmt(''); setDropPq(false); }}>New payment</button>}
        </>}
      </section>
      <aside className="card">
        <div className="card-head"><h2>Two signatures</h2><span className="card-sub">Made on this device</span></div>
        <div className="sigs">
          <div className="sig"><span className="lock-ico"><KeyRound size={17} /></span><span><b>ed25519</b><small>{sig.ed ? `${sig.ed} bytes · signed` : 'Your classical key'}</small></span>{sig.ed ? <Check size={18} className="ico-ok" /> : null}</div>
          <div className={`sig ${dropPq ? 'off' : ''}`}><span className="lock-ico pq"><Atom size={17} /></span><span><b>ML-DSA-65</b><small>{dropPq ? 'Left out for this test' : sig.pq ? `${sig.pq.toLocaleString()} bytes · signed` : 'Your post-quantum key'}</small></span>{dropPq ? <ShieldAlert size={18} className="ico-bad" /> : sig.pq ? <Check size={18} className="ico-ok" /> : null}</div>
          <p className="hint">The wallet contract runs <span className="mono">ed25519_verify</span> and <span className="mono">ml_dsa_verify</span> on the same message. Missing or wrong, either one stops the payment.</p>
        </div>
      </aside>
    </div>
  </>;
}
