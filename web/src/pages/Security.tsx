import { KeyRound, Atom, ExternalLink, Download, Check, X, ShieldCheck } from 'lucide-react';
import { useWallet, downloadJson } from '../lib/store.tsx';
import { keysUrl, short } from '../lib/chain.ts';
import { base64, pqHandle, sha256 } from '../../../sdk/index.ts';
import { base58 } from '@scure/base';
import { ReadOnlyBar } from '../ui/bits.tsx';
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
          <div><span>Contract</span><b>magen-1, open source (MIT)</b></div>
        </div>
      </section>
    </div>
    <section className="card rise">
      <div className="card-head"><h2>Readiness checklist</h2><span className="pill pill-blue">{r ? r.score : '—'} / 100</span></div>
      <div className="checks" style={{ margin: '14px 24px 24px' }}>
        {(r?.checks ?? []).map(c => <div className="check-row" key={c.label}>{c.ok ? <Check size={20} className="ico-ok" /> : <X size={20} className="ico-bad" />}<div><b>{c.label}</b><p>{c.detail}</p></div><span className="pts">{c.ok ? `+${c.points}` : `0 / ${c.points}`}</span></div>)}
      </div>
    </section>
    <div className="grid2">
      <section className="card card-pad rise" style={{ display: 'grid', gap: 14, alignContent: 'start' }}>
        <h2 style={{ fontSize: 17, fontWeight: 600 }}>Encrypted backup</h2>
        <p className="hint" style={{ fontSize: 14 }}>Both keys are sealed with your password (PBKDF2, 310,000 rounds, AES-256-GCM). There is no recovery service: keep the file and the password.</p>
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
