import { ArrowUpRight, ArrowDownLeft, Power, KeyRound, Atom, Check, X, RefreshCw, ExternalLink } from 'lucide-react';
import { useWallet } from '../lib/store.tsx';
import { accountUrl, near, readActivity, short } from '../lib/chain.ts';
import { grade } from '../../../sdk/scan.ts';
import { ActivityRow, CopyBtn, ReadOnlyBar, useAsync } from '../ui/bits.tsx';

export function readiness(account: string, live: ReturnType<typeof useWallet>['live']) {
  if (!live?.account) return null;
  return grade({
    account, network: 'testnet', implicit: false, balance: live.account.amount, storageUsage: live.account.storage, hasContract: true, isMagen: !!live.status,
    keys: live.keys.map(k => ({ publicKey: k.publicKey, scheme: k.scheme === 'ML-DSA-65' ? 'ml-dsa-65' : (k.scheme as any), fullAccess: k.full, receiver: k.receiver, methods: k.methods })),
  });
}

export function Dashboard() {
  const { account, live, refresh } = useWallet();
  const acts = useAsync(() => readActivity(account, 12), [account, live?.status?.nonce]);
  const r = readiness(account, live);
  const storage = live?.account ? BigInt(live.account.storage) * 10n ** 19n : 0n;
  const migrated = !!live?.status?.migrated;
  return <>
    <ReadOnlyBar />
    <h1 className="page-title-m only-m">Overview</h1>
    <div className="dash-top">
      <section className="balance rise">
        <img className="balance-art" src="/art/shield-wallet.webp" alt="" />
        <div className="lbl">Total balance <span className="pill pill-ink"><span className="dot" style={{ color: '#8fa8ff' }} />{migrated ? 'Native PQ key on' : 'Two locks on'}</span></div>
        <div className="amt">{live?.account ? near(live.account.amount, 2) : <span className="skel" style={{ display: 'inline-block', width: 200, height: 54, opacity: .15 }} />}<small>NEAR</small></div>
        <div className="acct"><span className="mono">{account}</span><CopyBtn text={account} label="Copy account" light />
          <a href={accountUrl(account)} target="_blank" rel="noreferrer" aria-label="Open in explorer" style={{ display: 'inline-flex' }}><ExternalLink size={15} /></a></div>
        <div className="quick">
          <a className="btn btn-primary" href="#/app/send"><ArrowUpRight size={18} />Send</a>
          <a className="btn btn-ghost-dark" href="#/app/receive"><ArrowDownLeft size={18} />Receive</a>
          <a className="btn btn-ghost-dark hide-m" href="#/app/qday"><Power size={17} />Q-Day switch</a>
        </div>
      </section>
      <section className="card">
        <div className="card-head"><h2>Quantum readiness</h2><a className="link" href="#/app/security">Details</a></div>
        <div className="score-line"><b>{r ? r.score : '—'}</b><span>/ 100</span></div>
        <div className="bar"><i style={{ width: `${r?.score ?? 0}%` }} /></div>
        <div className="locks">
          <div className="lock-row"><span className="lock-ico"><KeyRound size={18} /></span><span style={{ minWidth: 0 }}><b>Lock 1 · ed25519</b><small>Your existing key. Needed, never enough alone.</small></span>{live?.status ? <Check size={18} className="ico-ok" /> : <X size={18} className="ico-bad" />}</div>
          <div className="lock-row"><span className="lock-ico pq"><Atom size={18} /></span><span style={{ minWidth: 0 }}><b>Lock 2 · ML-DSA-65</b><small>Post-quantum. Checked on chain by NEAR.</small></span>{live?.status ? <Check size={18} className="ico-ok" /> : <X size={18} className="ico-bad" />}</div>
          <div className="lock-row"><span className="lock-ico pq"><Power size={18} /></span><span style={{ minWidth: 0 }}><b>Native post-quantum key</b><small>{migrated ? 'On. Listed in NEAR’s access keys.' : 'Off. Turn on with the Q-Day switch.'}</small></span>{migrated ? <Check size={18} className="ico-ok" /> : <span className="pill pill-gray">Off</span>}</div>
        </div>
      </section>
    </div>
    <div className="grid2">
      <section className="card">
        <div className="card-head"><h2>Assets</h2><span className="card-sub">Read from NEAR</span></div>
        <table className="table" style={{ marginTop: 8 }}>
          <thead><tr><th>Asset</th><th className="r">Balance</th></tr></thead>
          <tbody>
            <tr><td><span className="token"><span className="token-ico">N</span><span><b>NEAR</b><small>Testnet token</small></span></span></td><td className="r"><b>{near(live?.account?.amount, 4)}</b><div className="card-sub">NEAR</div></td></tr>
            <tr><td><span className="token"><span className="token-ico" style={{ background: 'var(--bg)', color: 'var(--text-2)' }}>S</span><span><b>Held for storage</b><small>{live?.account ? `${(live.account.storage / 1000).toFixed(1)} kB of contract and state` : '…'}</small></span></span></td><td className="r"><b>{live?.account ? near(storage, 4) : '—'}</b><div className="card-sub">NEAR, not spendable</div></td></tr>
          </tbody>
        </table>
      </section>
      <section className="card">
        <div className="card-head"><h2>Recent activity</h2><a className="link" href="#/app/activity">View all</a></div>
        <div className="acts" style={{ marginTop: 8 }}>
          {acts.loading && !acts.data ? [0, 1, 2].map(i => <div className="act-row" key={i}><span className="skel" style={{ width: 40, height: 40 }} /><span className="skel" style={{ height: 16 }} /><span /></div>)
            : acts.error ? <div className="empty"><b>History is unavailable</b>{acts.error}<button className="btn btn-light btn-sm" onClick={refresh}><RefreshCw size={14} />Retry</button></div>
            : acts.data?.length ? acts.data.slice(0, 5).map(a => <ActivityRow key={a.hash} a={a} />)
            : <div className="empty"><img src="/art/empty-activity.webp" alt="" /><b>No activity yet</b>Your first payment will show here.</div>}
        </div>
      </section>
    </div>
    <p className="hint">Balances refresh every 30 seconds from NEAR testnet RPC. Account <span className="mono">{short(account, 20, 8)}</span>.</p>
  </>;
}
