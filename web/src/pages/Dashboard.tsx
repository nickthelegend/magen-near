import { useEffect, useState } from 'react';
import { ArrowUpRight, ArrowDownLeft, Repeat, Globe, KeyRound, Atom, Power, Check, X, RefreshCw, ChevronRight, ShieldCheck, Plus, ExternalLink } from 'lucide-react';
import { useWallet } from '../lib/store.tsx';
import { accountUrl, near, readActivity } from '../lib/chain.ts';
import { grade } from '../../../sdk/scan.ts';
import { view } from '../../../sdk/index.ts';
import { ActivityRow, CopyBtn, ReadOnlyBar, useAsync } from '../ui/bits.tsx';
import { ChainLogo } from '../ui/chain.tsx';
import { useBalances, useChains, fmt, shortAddr } from '../lib/multi.ts';

export function readiness(account: string, live: ReturnType<typeof useWallet>['live']) {
  if (!live?.account) return null;
  return grade({
    account, network: 'testnet', implicit: false, balance: live.account.amount, storageUsage: live.account.storage, hasContract: true, isMagen: !!live.status,
    keys: live.keys.map(k => ({ publicKey: k.publicKey, scheme: k.scheme === 'ML-DSA-65' ? 'ml-dsa-65' : (k.scheme as any), fullAccess: k.full, receiver: k.receiver, methods: k.methods })),
  });
}

/** NEP-141 tokens the wallet can hold on NEAR, read live. */
export const NEAR_TOKENS = [
  { id: 'usdt', token: 'usdt.itachicara.testnet', symbol: 'USDT', name: 'USDT · Ref testnet token', decimals: 24 },
  { id: 'usdc', token: 'usdc.itachicara.testnet', symbol: 'USDC', name: 'USDC · Ref testnet token', decimals: 24 },
  { id: 'near', token: 'wrap.testnet', symbol: 'wNEAR', name: 'Wrapped NEAR', decimals: 24 },
  { id: 'bitcoin', token: 'nbtc.n-bridge.testnet', symbol: 'nBTC', name: 'Bitcoin, bridged by Omni', decimals: 8 },
  { id: 'zcash', token: 'nzcash.n-bridge.testnet', symbol: 'nZEC', name: 'Zcash, bridged by Omni', decimals: 8 },
];
export function useTokens(account: string, tick = 0) {
  const [m, set] = useState<Record<string, number | null>>({});
  useEffect(() => {
    let on = true;
    const load = () => Promise.all(NEAR_TOKENS.map(async t => {
      try { const b = BigInt(await view(t.token, 'ft_balance_of', { account_id: account })); if (on) set(s => ({ ...s, [t.token]: Number(b / 10n ** BigInt(Math.max(0, t.decimals - 8))) / 1e8 })); }
      catch { if (on) set(s => ({ ...s, [t.token]: null })); }
    }));
    load(); const i = setInterval(load, 30000); return () => { on = false; clearInterval(i); };
  }, [account, tick]);
  return m;
}

export function Dashboard() {
  const { account, live, refresh, readOnly } = useWallet();
  const acts = useAsync(() => readActivity(account, 12), [account, live?.status?.nonce]);
  const tokens = useTokens(account, Number(live?.status?.nonce ?? 0));
  const { rows, pq } = useChains();
  const bals = useBalances(rows);
  const migrated = !!live?.status?.migrated;
  const held = NEAR_TOKENS.filter(t => (tokens[t.token] ?? 0) > 0);
  const others = (rows ?? []).filter(r => r.id !== 'near');
  return <>
    <ReadOnlyBar />
    <div className="home-w2"><div className="w2h">
      <section className="w2h-card rise">
        <div className="w2-bal"><small>Current Balance</small>
          <b className="num">{live?.account ? <>{near(live.account.amount, 2).split('.')[0]}<span>.{near(live.account.amount, 2).split('.')[1] ?? '00'}</span></> : '…'}<i>NEAR</i></b>
          <span className="w2h-acct"><span className="mono">{account}</span><CopyBtn text={account} label="Copy account" /><a href={accountUrl(account)} target="_blank" rel="noreferrer" aria-label="Open in explorer"><ExternalLink size={14} /></a></span>
        </div>
        <div className="w2-avs"><small>Your Chains</small><div>{['near', 'bitcoin', 'zcash', 'ethereum', 'solana'].map(id => <ChainLogo key={id} id={id} />)}<a className="w2-plus" href="#/app/chains" aria-label="All chains"><Plus size={18} /></a></div></div>
        {(() => {
          const nearN = live?.account ? Number(live.account.amount / 10n ** 20n) / 1e4 : undefined;
          const list = [{ id: 'near', name: 'NEAR', v: nearN, href: '#/app/send' }, ...NEAR_TOKENS.filter(t => t.id !== 'near' && t.id !== 'usdc').map(t => ({ id: t.id, name: t.symbol, v: tokens[t.token] ?? undefined, href: t.id === 'bitcoin' || t.id === 'zcash' ? '#/app/bridge' : '#/app/swap' }))];
          const max = Math.max(...list.map(x => x.v ?? 0), 1e-9);
          return list.map(x => <div key={x.id} className="w2-row"><div className="w2-row-h"><b>{x.name}</b><a href="#/app/activity"><small>History</small></a></div>
            <a className="w2-bar" href={x.href}><div className="w2-fill" style={{ width: `${Math.max(.24, (x.v ?? 0) / max) * 100}%` }}><ChainLogo id={x.id} size="sm" /><b className="num">{x.v === undefined ? '…' : x.v === null ? '—' : fmt(x.v, x.id === 'near' ? 2 : 6)}</b></div></a></div>);
        })()}
      </section>
      <div className="w2h-acts">
        {[['receive', 'Receive', ArrowDownLeft], ['send', 'Send', ArrowUpRight], ['swap', 'Swap', Repeat], ['bridge', 'Bridge', Globe]].map(([to, l, I]: any) =>
          <a key={to} className="w2h-act" href={`#/app/${to}`}><span><I size={20} /></span>{l}</a>)}
      </div>
      <a className="w2h-lock" href="#/app/qday"><span className="ico"><ShieldCheck size={22} /></span><span><b>{migrated ? 'Quantum-only key is on' : 'Two locks on every move'}</b><small>ed25519 + ML-DSA-65, both checked on NEAR</small></span><ChevronRight size={18} /></a>
      <section className="card locks-card">
        <div className="card-head"><h2>Your two locks</h2><a className="link" href="#/app/security">Keys</a></div>
        <div className="locks">
          <div className="lock-row"><span className="lock-ico"><KeyRound size={18} /></span><span><b>ed25519</b><small>Classical. Needed, never enough alone.</small></span>{live?.status ? <Check size={18} className="ico-ok" /> : <X size={18} className="ico-bad" />}</div>
          <div className="lock-row"><span className="lock-ico pq"><Atom size={18} /></span><span><b>ML-DSA-65</b><small>{pq ? `Quantum-safe · from your 12 words` : 'Quantum-safe · checked on NEAR'}</small></span>{live?.status ? <Check size={18} className="ico-ok" /> : <X size={18} className="ico-bad" />}</div>
          <a className="lock-row" href="#/app/qday"><span className="lock-ico pq"><Power size={18} /></span><span><b>Q-Day switch</b><small>{migrated ? 'On: NEAR lists your ML-DSA key.' : 'Off until you need it.'}</small></span><ChevronRight size={18} color="var(--text-3)" /></a>
        </div>
      </section>
    </div>

    <div className="grid2">
      <section className="card">
        <div className="card-head"><h2>Same 12 words, other chains</h2><a className="link" href="#/app/chains">See all {rows?.length ? rows.length : ''}</a></div>
        <div className="list">
          {!rows ? [0, 1, 2, 3].map(i => <div key={i} className="list-row"><span className="skel" style={{ width: 36, height: 36, borderRadius: '50%' }} /><span className="skel" style={{ height: 16 }} /><span /></div>)
            : !others.length ? <div className="empty"><b>This wallet has no recovery phrase</b>It was upgraded from an older account. Create a new wallet to open every chain.</div>
            : others.slice(0, 6).map(r => { const b = bals[r.id]; return <a key={r.id} className="list-row" href="#/app/chains">
              <ChainLogo id={r.id} /><span className="mid"><b>{r.name}</b><small className="mono">{shortAddr(r.address, 7)}</small></span>
              <span className="r"><b>{!b || b.state === 'loading' ? '…' : b.state === 'ok' ? fmt(b.value) : '—'}</b><small>{b?.state === 'ok' ? b.symbol : r.network}</small></span></a>; })}
        </div>
      </section>
      <section className="card">
        <div className="card-head"><h2>Recent activity</h2><a className="link" href="#/app/activity">All</a></div>
        <div className="acts">
          {acts.loading && !acts.data ? [0, 1, 2].map(i => <div className="act-row" key={i}><span className="skel" style={{ width: 40, height: 40, borderRadius: '50%' }} /><span className="skel" style={{ height: 16 }} /><span /></div>)
            : acts.error ? <div className="empty"><b>History is unavailable</b>{acts.error}<button className="btn btn-light btn-sm" onClick={refresh}><RefreshCw size={14} />Retry</button></div>
            : acts.data?.length ? acts.data.slice(0, 6).map(a => <ActivityRow key={a.hash} a={a} />)
            : <div className="empty"><b>No activity yet</b>{readOnly ? 'The demo wallet is quiet.' : 'Your first move shows here.'}</div>}
        </div>
      </section>
    </div></div>
  </>;
}
