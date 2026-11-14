import { GuardianRecovery } from '../ui/Recovery.tsx';
import { useState } from 'react';
import { KeyRound, Atom, ExternalLink, Download, Check, X, ShieldCheck, Users } from 'lucide-react';
import { useWallet, downloadJson, feeSigner } from '../lib/store.tsx';
import { friendlyError, keysUrl, short } from '../lib/chain.ts';
import { base64, execute, makeIntent, pqHandle, sha256, signIntent, view } from '../../../sdk/index.ts';
import { newGuardian, guardianPublic, setGuardians } from '../../../sdk/guardians.ts';
import { base58 } from '@scure/base';
import { ReadOnlyBar, Spinner, TxLink } from '../ui/bits.tsx';
import { readiness } from './Dashboard.tsx';

export function Security() {
  const { account, live, vault, backup } = useWallet();
  const st = live?.status;
  const r = readiness(account, live);
  const edPub = st ? 'ed25519:' + base58.encode(base64.decode(st.ed as any)) : '';
  const pqBytes = st ? base64.decode(st.pq as any) : null;
  const pqId = pqBytes ? pqHandle(pqBytes) : '';
  const pqFinger = pqBytes ? base58.encode(sha256(pqBytes)).slice(0, 16) : '';
  return <>
    <ReadOnlyBar />
    <h1 className="page-title-m only-m">Keys & security</h1>
    <div className="grid2">
      <section className="card rise">
        <div className="card-head"><h2>What NEAR sees</h2><a className="link" href={keysUrl(account)} target="_blank" rel="noreferrer">Explorer <ExternalLink size={13} /></a></div>
        <p className="card-sub" style={{ padding: '6px 24px 0' }}>The account’s access keys, read live with view_access_key_list.</p>
        <div className="keylist" style={{ marginTop: 10 }}>
          {!live ? <div className="keyrow"><span className="skel" style={{ width: 40, height: 40 }} /><span className="skel" style={{ height: 16 }} /><span /></div>
            : live.keys.length === 0 ? <div className="empty"><b>No access keys</b>Only the contract can act for this account.</div>
            : live.keys.map(k => <div className="keyrow" key={k.publicKey}>
              <span className={`lock-ico ${k.scheme === 'ML-DSA-65' ? 'pq' : ''}`}>{k.scheme === 'ML-DSA-65' ? <Atom size={18} /> : <KeyRound size={18} />}</span>
              <span style={{ minWidth: 0 }}><b>{k.scheme} · {k.full ? 'full access' : `may only call ${k.methods?.join(', ')}`}</b><span className="mono">{k.publicKey}</span></span>
              <span className={`pill ${k.full && k.scheme !== 'ML-DSA-65' ? 'pill-red' : k.full ? 'pill-blue' : 'pill-gray'}`}>{k.full ? (k.scheme === 'ML-DSA-65' ? 'Post-quantum' : 'Can spend') : 'Can’t spend'}</span>
            </div>)}
        </div>
      </section>
      <section className="card rise">
        <div className="card-head"><h2>The two locks</h2><span className="card-sub">Stored in the contract</span></div>
        <div className="kv" style={{ marginTop: 10 }}>
          <div><span>Lock 1 · ed25519</span><b className="mono">{edPub ? short(edPub, 18, 6) : '—'}</b></div>
          <div><span>Lock 2 · ML-DSA-65</span><b className="mono">{pqBytes ? `${pqBytes.length.toLocaleString()} B · ${pqFinger}…` : '—'}</b></div>
          <div><span>As a native NEAR key</span><b className="mono">{pqId ? short(pqId, 22, 6) : '—'}</b></div>
          <div><span>Payments signed so far</span><b>{st ? st.nonce : '—'}</b></div>
          <div><span>Native PQ key</span><b>{st?.migrated ? 'On' : 'Off'}</b></div>
          <div><span>Contract</span><b>{st?.version ?? 'magen-1'}, open source (MIT)</b></div>
        </div>
      </section>
    </div>
    <section className="card rise">
      <div className="card-head"><h2>Readiness checklist</h2><span className="pill pill-blue">{r ? r.score : '—'} / 100</span></div>
      <div className="checks" style={{ margin: '14px 24px 24px' }}>
        {(r?.checks ?? []).map(c => <div className="check-row" key={c.label}>{c.ok ? <Check size={20} className="ico-ok" /> : <X size={20} className="ico-bad" />}<div><b>{c.label}</b><p>{c.detail}</p></div><span className="pts">{c.ok ? `+${c.points}` : `0 / ${c.points}`}</span></div>)}
      </div>
    </section>
    <Guardians /><GuardianRecovery/>
    <div className="grid2">
      <section className="card card-pad rise" style={{ display: 'grid', gap: 14, alignContent: 'start' }}>
        <h2 style={{ fontSize: 17, fontWeight: 600 }}>Encrypted backup</h2>
        <p className="hint" style={{ fontSize: 14 }}>Both keys are sealed with your password (PBKDF2, 310,000 rounds, AES-256-GCM). Keep the file and the password. Without them, only guardians (if you set them) can move your locks to a new device.</p>
        <button className="btn btn-dark" disabled={!vault || !backup()} onClick={() => downloadJson(backup(), 'magen-encrypted-backup.json')}><Download size={17} />{vault ? 'Download encrypted backup' : 'Unlock to download'}</button>
      </section>
      <section className="card card-pad rise" style={{ display: 'grid', gap: 12, alignContent: 'start' }}>
        <h2 style={{ fontSize: 17, fontWeight: 600, display: 'flex', gap: 8, alignItems: 'center' }}><ShieldCheck size={18} />Honest limits</h2>
        <ul style={{ paddingLeft: 18, display: 'grid', gap: 8, fontSize: 14, color: 'var(--text-2)', lineHeight: 1.55 }}>
          <li>Both keys live on this device, so Magen protects against broken cryptography, not a stolen, unlocked device.</li>
          <li>The execute-only key pays network fees. A thief holding it alone can burn at most its 1 NEAR fee allowance, never move funds.</li>
          <li>After the Q-Day switch, the ML-DSA-65 key alone controls the account at the protocol level.</li>
        </ul>
      </section>
    </div>
  </>;
}

const fp = (b64: string) => base58.encode(sha256(base64.decode(b64))).slice(0, 10);
/** Guardians (contract magen-2): k-of-n ML-DSA-65 keys that can rotate both locks if this device is lost. */
function Guardians() {
  const { live, vault, refresh, account } = useWallet();
  const [busy, setBusy] = useState(''); const [err, setErr] = useState(''); const [hash, setHash] = useState('');
  const st = live?.status;
  if (!st) return null;
  const v2 = st.version === 'magen-2';
  const setup = async () => {
    if (!vault) return; setErr('');
    try {
      setBusy('Making three guardian keys on this device…');
      const gs = ['Guardian 1', 'Guardian 2', 'Guardian 3'].map(newGuardian);
      gs.forEach((g, i) => downloadJson({ kind: 'magen-guardian-kit', wallet: account, index: i, name: g.name, seed: g.seed, note: 'Give this file to someone you trust. Two of three can restore this wallet.' }, `magen-guardian-${i + 1}-${account}.json`));
      setBusy('Signing the guardian set with both keys…');
      const s = await view(vault.wallet);
      const r = await execute(feeSigner(vault, live), vault.wallet, signIntent(makeIntent(vault.wallet, s.nonce, setGuardians(gs.map(guardianPublic), 2)), vault.keys));
      if (!r.success) throw Error(r.error);
      setHash(r.hash); setTimeout(refresh, 2500);
    } catch (e: any) { setErr(friendlyError(String(e.message))); } finally { setBusy(''); }
  };
  return <section className="card rise">
    <div className="card-head"><h2 style={{ display: 'flex', gap: 8, alignItems: 'center' }}><Users size={18} />Guardians</h2>
      <span className={`pill ${st.threshold ? 'pill-blue' : 'pill-gray'}`}>{st.threshold ? `${st.threshold} of ${st.guardians?.length}` : 'Not set'}</span></div>
    <div style={{ padding: '10px 24px 22px', display: 'grid', gap: 12 }}>
      <p className="hint" style={{ fontSize: 14 }}>Lose this device and guardians can move both locks to a new one. Each guardian holds an ML-DSA-65 key; the contract needs two of three valid signatures, checked on chain. Guardians can never spend.</p>
      {st.threshold ? <div className="keylist">{st.guardians!.map((g, i) => <div className="keyrow" key={g} style={{ padding: '10px 0' }}>
        <span className="lock-ico pq"><Atom size={18} /></span><span style={{ minWidth: 0 }}><b>Guardian {i + 1}</b><span className="mono">ML-DSA-65 · {fp(g)}…</span></span><span className="pill pill-gray">can restore, can’t spend</span></div>)}</div>
        : !v2 ? <div className="banner banner-gray"><Users size={18} /><div>This account runs wallet contract {st.version ?? 'magen-1'}. Guardians come with magen-2, used by accounts upgraded from Nov 14.</div></div>
        : vault ? <button className="btn btn-dark" onClick={setup} disabled={!!busy} style={{ justifySelf: 'start' }}>{busy ? <><Spinner />{busy}</> : <><Users size={17} />Set up 2-of-3 guardians</>}</button>
        : <p className="hint">Unlock the wallet to add guardians.</p>}
      {hash && <TxLink hash={hash} label="View the guardian transaction" />}
      {err && <div className="banner banner-red"><X size={18} /><div>{err}</div></div>}
    </div>
  </section>;
}
