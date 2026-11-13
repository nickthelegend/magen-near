import { useState } from 'react';
import { Atom, ExternalLink, ShieldCheck, ShieldAlert, KeyRound } from 'lucide-react';
import { useWallet } from '../lib/store.tsx';
import { friendlyError, keysUrl, short } from '../lib/chain.ts';
import { actions, execute, makeIntent, nearAmount, outcome, pqHandle, publicKeys, signIntent, submit, view } from '../../../sdk/index.ts';
import { ReadOnlyBar, Spinner, TxLink } from '../ui/bits.tsx';

export function QDay() {
  const { vault, live, refresh, readOnly, account } = useWallet();
  const on = !!live?.status?.migrated;
  const [agree, setAgree] = useState(false); const [busy, setBusy] = useState(''); const [err, setErr] = useState('');
  const [res, setRes] = useState<{ hash: string; success: boolean; error: string } | null>(null);
  const [proof, setProof] = useState<{ hash: string; success: boolean; error: string } | null>(null);
  const nativeKey = live?.keys.find(k => k.scheme === 'ML-DSA-65');
  const flip = async () => {
    if (!vault) return; setErr(''); setRes(null);
    try {
      setBusy('Signing the switch with both keys…');
      const s = await view(vault.wallet);
      const signed = signIntent(makeIntent(vault.wallet, s.nonce, { kind: 'migrate' }), vault.keys);
      setBusy('NEAR is checking both signatures and adding the native key…');
      const r = await execute(vault.relay, vault.wallet, signed);
      setRes(r); if (!r.success) setErr(friendlyError(r.error));
      await new Promise(x => setTimeout(x, 2500)); await refresh();
    } catch (e: any) { setErr(friendlyError(String(e.message))); } finally { setBusy(''); }
  };
  const prove = async () => {
    if (!vault) return; setErr(''); setProof(null);
    try {
      setBusy('Signing a 0.01 NEAR self-transfer with the ML-DSA-65 key only…');
      const r = outcome(await submit({ account: vault.wallet, seed: vault.keys.pq, pq: true }, vault.wallet, [actions.transfer(BigInt(nearAmount('0.01')))]));
      setProof(r); refresh();
    } catch (e: any) { setErr(friendlyError(String(e.message))); } finally { setBusy(''); }
  };
  const handle = vault ? pqHandle(publicKeys(vault.keys).pq) : nativeKey?.publicKey;
  return <>
    <ReadOnlyBar />
    <h1 className="page-title-m only-m">Q-Day switch</h1>
    <section className="card qday rise">
      <div className="qday-left">
        <span className={`pill ${on ? 'pill-blue' : 'pill-ink'}`} style={{ alignSelf: 'start', justifySelf: 'start' }}><span className="dot" />{on ? 'Switched on' : 'Off'}</span>
        <h2>{on ? 'Your post-quantum key is now a native NEAR key.' : 'When classical keys fall, flip one switch.'}</h2>
        <p>{on ? 'NEAR lists your ML-DSA-65 key in the account’s access keys. It can sign transactions by itself, at the protocol level, with no contract in between.'
          : 'The switch adds your ML-DSA-65 key to this same account as a native NEAR full-access key. Your name, balance and history stay. The switch itself needs both signatures.'}</p>
        <div className="bigswitch">
          <button className={`switch blue ${on ? 'on' : ''}`} role="switch" aria-checked={on} aria-label="Q-Day switch" disabled={on || readOnly || !agree || !!busy} onClick={flip} />
          <span><b>{on ? 'Native ML-DSA-65 key: on' : 'Add native ML-DSA-65 key'}</b><small>{busy || (on ? 'Recorded on NEAR testnet' : readOnly ? 'Unlock your wallet to use the switch' : 'Signed with both locks')}</small></span>
          {busy && <Spinner />}
        </div>
        {!on && !readOnly && <label className="check" style={{ color: 'var(--on-ink-2)' }}><input type="checkbox" checked={agree} onChange={e => setAgree(e.target.checked)} />I understand: after the switch, my ML-DSA-65 key alone controls this account at the protocol level.</label>}
        {res?.success && <TxLink hash={res.hash} label="View the switch transaction" />}
      </div>
      <div className="qday-right">
        <h3 style={{ fontSize: 17, fontWeight: 600 }}>Access keys on NEAR</h3>
        {live?.keys.map(k => <div className="keyrow" key={k.publicKey} style={{ padding: '12px 0', borderTop: '1px solid var(--line-2)' }}>
          <span className={`lock-ico ${k.scheme === 'ML-DSA-65' ? 'pq' : ''}`}>{k.scheme === 'ML-DSA-65' ? <Atom size={18} /> : <KeyRound size={18} />}</span>
          <span style={{ minWidth: 0 }}><b>{k.scheme}</b><span className="mono">{k.publicKey}</span></span>
          <span className={`pill ${k.full ? 'pill-blue' : 'pill-gray'}`}>{k.full ? 'Full access' : 'execute only'}</span>
        </div>)}
        {!on && handle && <div className="banner banner-gray"><Atom size={18} /><div><strong>Will appear as</strong><span className="mono" style={{ overflowWrap: 'anywhere' }}>{short(handle, 26, 8)}</span></div></div>}
        {on && <a className="link" href={keysUrl(account)} target="_blank" rel="noreferrer">See it in the explorer’s key list <ExternalLink size={13} /></a>}
        <div className="compare">
          <div><b>Before</b>Two signatures in a contract. Strongest while classical keys still hold.</div>
          <div><b>After</b>Plus a native post-quantum key NEAR checks itself, at 100 Ggas per signature.</div>
        </div>
        {on && vault && <button className="btn btn-light" onClick={prove} disabled={!!busy}>{busy ? <Spinner /> : <ShieldCheck size={17} />}Prove it: sign a transaction with the native key</button>}
        {proof && (proof.success ? <div className="banner banner-green"><ShieldCheck size={18} /><div><strong>Signed by ML-DSA-65 alone and accepted.</strong><TxLink hash={proof.hash} /></div></div>
          : <div className="banner banner-red"><ShieldAlert size={18} /><div>{friendlyError(proof.error)}</div></div>)}
        {err && <div className="banner banner-red"><ShieldAlert size={18} /><div>{err}</div></div>}
      </div>
    </section>
  </>;
}
