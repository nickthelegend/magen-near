import type { ReactNode } from 'react';
import { LayoutGrid, ArrowUpRight, ArrowDownLeft, History, ShieldCheck, Power, Crosshair, Lock, LockOpen, ChevronRight, Home } from 'lucide-react';
import { useWallet, DEMO } from '../lib/store.tsx';
import { short } from '../lib/chain.ts';

const NAV = [
  { to: '', label: 'Overview', icon: LayoutGrid },
  { to: 'send', label: 'Send', icon: ArrowUpRight },
  { to: 'receive', label: 'Receive', icon: ArrowDownLeft },
  { to: 'activity', label: 'Activity', icon: History },
];
const PROTECT = [
  { to: 'security', label: 'Keys & security', icon: ShieldCheck },
  { to: 'qday', label: 'Q-Day switch', icon: Power },
  { to: 'drill', label: 'Key-recovery drill', icon: Crosshair },
];
const TABS = [
  { to: '', label: 'Home', icon: Home }, { to: 'send', label: 'Send', icon: ArrowUpRight }, { to: 'activity', label: 'Activity', icon: History },
  { to: 'security', label: 'Security', icon: ShieldCheck }, { to: 'drill', label: 'Drill', icon: Crosshair },
];
const TITLES: Record<string, string> = { '': 'Overview', send: 'Send', receive: 'Receive', activity: 'Activity', security: 'Keys & security', qday: 'Q-Day switch', drill: 'Key-recovery drill' };

export function AppShell({ route, children }: { route: string; children: ReactNode }) {
  const { vault, account, live, lock, readOnly } = useWallet();
  const migrated = live?.status?.migrated;
  const status = !live ? 'Loading…' : migrated ? 'Two locks + native PQ key' : live.status ? 'Two locks on' : 'Plain account';
  return <div className="app">
    <aside className="side">
      <a className="brand" href="#/"><img src="/art/icon.webp" alt="" />magen</a>
      <a className="acct-switch" href={readOnly ? '#/start' : '#/app/security'}>
        <span className="avatar">{account[0].toUpperCase()}</span>
        <span className="who"><b>{readOnly ? DEMO.label : short(account, 18, 8)}</b><small>{readOnly ? short(account, 16, 8) : status}</small></span>
        <ChevronRight size={16} />
      </a>
      <nav className="side-nav">
        {NAV.map(n => <a key={n.to} href={`#/app${n.to ? '/' + n.to : ''}`} className={route === n.to ? 'on' : ''}><n.icon size={18} />{n.label}</a>)}
        <span className="side-label">Protection</span>
        {PROTECT.map(n => <a key={n.to} href={`#/app/${n.to}`} className={route === n.to ? 'on' : ''}><n.icon size={18} />{n.label}{n.to === 'qday' && <span className={`badge pill ${migrated ? 'pill-blue' : 'pill-gray'}`}>{migrated ? 'On' : 'Off'}</span>}</a>)}
      </nav>
      <div className="side-foot">
        <span className="netline"><span className="dot" />NEAR testnet</span>
        {vault ? <button className="btn btn-light btn-sm" onClick={lock}><Lock size={15} /> Lock wallet</button>
          : <a className="btn btn-dark btn-sm" href="#/start"><LockOpen size={15} /> Unlock or upgrade</a>}
      </div>
    </aside>
    <div className="main">
      <header className="top"><h1>{TITLES[route] ?? ''}</h1>
        <div className="top-right">
          <span className={`pill ${readOnly ? 'pill-gray' : 'pill-green'}`}><span className="dot" />{readOnly ? 'View only' : 'Unlocked'}</span>
          <span className="pill pill-blue">{status}</span>
        </div>
      </header>
      <header className="mtop">
        <a className="brand" href="#/"><img src="/art/icon.webp" alt="" />magen</a>
        <div className="mtop-right">
          <span className={`pill ${readOnly ? 'pill-gray' : 'pill-green'}`}>{readOnly ? 'View only' : 'Unlocked'}</span>
          {vault ? <button className="btn btn-light btn-sm" aria-label="Lock wallet" onClick={lock} style={{ padding: '0 10px' }}><Lock size={15} /></button>
            : <a className="btn btn-dark btn-sm" href="#/start">Unlock</a>}
        </div>
      </header>
      <main className="page">{children}</main>
      <nav className="tabbar">{TABS.map(t => <a key={t.to} href={`#/app${t.to ? '/' + t.to : ''}`} className={route === t.to ? 'on' : ''}><t.icon size={21} />{t.label}</a>)}</nav>
    </div>
  </div>;
}
