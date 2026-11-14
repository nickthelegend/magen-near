import { useEffect, useState } from 'react';
import { ArrowUpRight, ArrowDownLeft, Repeat, Globe, KeyRound, Atom, Power, Check, X, RefreshCw, ChevronRight, Search, Settings, ShieldCheck } from 'lucide-react';
import { useWallet } from '../lib/store.tsx';
import { near, readActivity, short } from '../lib/chain.ts';
import { grade } from '../../../sdk/scan.ts';
import { view } from '../../../sdk/index.ts';
import { ActivityRow, CopyBtn, ReadOnlyBar, useAsync } from '../ui/bits.tsx';
import { Mark } from '../ui/Logo.tsx';
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
    <div className="m3-home">
      <div className="m3-profile">
        <span className="m3-avatar"><Mark size={34} /></span>
        <span className="who"><b>{account.replace(/\.testnet$/, '')}</b><small className="mono">{short(account, 10, 8)}</small></span>
        <CopyBtn text={account} label="Copy account" />
        <a className="m3-round" href="#/app/security" aria-label="Keys and guardians"><Settings size={20} /></a>
      </div>
      <div className="m3-search">
        <a className="m3-field" href="#/app/chains"><Search size={18} />Search chains and tokens</a>
        <a className="btn btn-primary m3-swap" href="#/app/swap">Swap</a>
      </div>
      <section className="m3-balance rise">
        <div className="lbl">Balance<span className="m3-up"><ShieldCheck size={14} />{migrated ? 'Quantum-only' : 'Two locks on'}</span></div>
        <div className="amt num">{live?.account ? <>{near(live.account.amount, 2).split('.')[0]}.<span>{near(live.account.amount, 2).split('.')[1] ?? '00'}</span></> : <span className="skel" style={{ display: 'inline-block', width: 200, height: 52 }} />}<small>NEAR</small></div>
      </section>
      <div className="m3-actions">
        {[['receive', 'Receive', ArrowDownLeft], ['send', 'Send', ArrowUpRight], ['swap', 'Swap', Repeat], ['bridge', 'Bridge', Globe]].map(([to, l, I]: any) =>
          <a key={to} className="m3-act" href={`#/app/${to}`}><span><I size={22} strokeWidth={1.7} /></span>{l}</a>)}
      </div>
      <a className="m3-welcome" href="#/app/qday">
        <img src="/v4/onboard-quantum-lock.png" alt="" width={64} height={64} />
        <span><b>{migrated ? 'Quantum-only key is on' : 'Your quantum-safe lock is on'}</b><small>Every move needs your ed25519 and ML-DSA-65 signatures. Tap for the Q-Day switch.</small></span>
        <ChevronRight size={18} color="var(--text-3)" />
      </a>
      <h3 className="m3-h">Your coins on NEAR</h3>
      <div className="m3-list">
        <a className="m3-row" href="#/app/send"><ChainLogo id="near" /><span className="mid"><b>NEAR</b><small>Native · gas</small></span><span className="r"><b className="num">{live?.account ? near(live.account.amount, 4) : '…'}</b><small>NEAR</small></span></a>
        {NEAR_TOKENS.filter(t => t.id !== 'near').map(t => { const v = tokens[t.token]; return <a key={t.token} className="m3-row" href={t.id === 'bitcoin' || t.id === 'zcash' ? '#/app/bridge' : '#/app/swap'}><ChainLogo id={t.id === 'usdc' ? 'usdc' : t.id} /><span className="mid"><b>{t.symbol}</b><small>{t.name}</small></span><span className="r"><b className="num">{v === undefined ? '…' : v === null ? '—' : fmt(v, 4)}</b><small>{t.symbol}</small></span></a>; })}
      </div>
      <section className="card locks-card m3-locks">
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
    </div>
  </>;
}
