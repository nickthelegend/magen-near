import type { ReactNode } from 'react';
import { LayoutGrid, ArrowUpRight, ArrowDownLeft, History, ShieldCheck, Power, Crosshair, Lock, LockOpen, ChevronRight, Home, Network, EyeOff, Repeat } from 'lucide-react';
import { useWallet, DEMO } from '../lib/store.tsx';
import { short } from '../lib/chain.ts';

const NAV = [
  { to: '', label: 'Overview', icon: LayoutGrid },
  { to: 'send', label: 'Send', icon: ArrowUpRight },
  { to: 'receive', label: 'Receive', icon: ArrowDownLeft },
  { to: 'activity', label: 'Activity', icon: History },
  { to: 'chains', label: 'Chains', icon: Network },
  { to: 'private', label: 'Private send', icon: EyeOff },
  { to: 'swap', label: 'Swap & bridge', icon: Repeat },
];
const PROTECT = [
  { to: 'security', label: 'Keys & security', icon: ShieldCheck },
  { to: 'qday', label: 'Q-Day switch', icon: Power },
  { to: 'drill', label: 'Key-recovery drill', icon: Crosshair },
];
const TABS = [
  { to: '', label: 'Home', icon: Home }, { to: 'activity', label: 'Activity', icon: History }, { to: 'send', label: 'Send, signed twice', icon: ArrowUpRight },
  { to: 'security', label: 'Keys and security', icon: ShieldCheck }, { to: 'drill', label: 'Key-recovery drill', icon: Crosshair },
];
/** Magen's quantum-shield mark: a lattice shield with a send arrow. */
export const ShieldSend = ({ size = 26 }: { size?: number }) => <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
  <path d="M16 3.5 26 7.2v7.6c0 6.3-4.2 11.2-10 13.7C10.2 26 6 21.1 6 14.8V7.2L16 3.5Z" stroke="#fff" strokeWidth="1.8" strokeLinejoin="round" />
  <path d="M11 10v11M21 10v11M8.5 15.5h15" stroke="#fff" strokeOpacity=".45" strokeWidth="1.2" />
  <path d="M12.5 19.5 19.5 12.5M14 12.5h5.5V18" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
</svg>;
const TITLES: Record<string, string> = { chains: 'Chains', private: 'Private send', swap: 'Swap & bridge', '': 'Overview', send: 'Send', receive: 'Receive', activity: 'Activity', security: 'Keys & security', qday: 'Q-Day switch', drill: 'Key-recovery drill' };

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
      <nav className="tabbar" aria-label="Wallet" style={{ ['--i' as any]: Math.max(0, TABS.findIndex(t => t.to === route)) }} data-send={route === 'send' ? '1' : undefined}>
        {TABS.map(t => <a key={t.to} href={`#/app${t.to ? '/' + t.to : ''}`} aria-label={t.label} aria-current={route === t.to ? 'page' : undefined} className={`${route === t.to ? 'on' : ''} ${t.to === 'send' ? 'tab-send' : ''}`}>
          {t.to === 'send' ? <span className="fab"><ShieldSend /></span> : <t.icon size={22} strokeWidth={route === t.to ? 2 : 1.6} fill={route === t.to ? 'rgba(143,168,255,.35)' : 'none'} />}
        </a>)}
      </nav>
    </div>
  </div>;
}
