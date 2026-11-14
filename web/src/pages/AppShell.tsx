import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { Home, ArrowUpRight, ArrowDownLeft, History, ShieldCheck, Power, Crosshair, Lock, LockOpen, ChevronRight, Layers, EyeOff, Repeat, Globe } from 'lucide-react';
import { useWallet, DEMO } from '../lib/store.tsx';
import { short } from '../lib/chain.ts';
import { Brand, Mark } from '../ui/Logo.tsx';

const NAV = [
  { to: '', label: 'Home', icon: Home },
  { to: 'chains', label: 'All chains', icon: Layers },
  { to: 'send', label: 'Send', icon: ArrowUpRight },
  { to: 'receive', label: 'Receive', icon: ArrowDownLeft },
  { to: 'swap', label: 'Swap', icon: Repeat },
  { to: 'bridge', label: 'Bridge', icon: Globe },
  { to: 'private', label: 'Private send', icon: EyeOff },
  { to: 'activity', label: 'Activity', icon: History },
];
const PROTECT = [
  { to: 'security', label: 'Keys & guardians', icon: ShieldCheck },
  { to: 'qday', label: 'Q-Day switch', icon: Power },
  { to: 'drill', label: 'Steal-the-key drill', icon: Crosshair },
];
const TABS = [
  { to: '', label: 'Home', icon: Home }, { to: 'chains', label: 'Chains', icon: Layers }, { to: 'send', label: 'Send', icon: ArrowUpRight },
  { to: 'swap', label: 'Swap', icon: Repeat }, { to: 'security', label: 'Security', icon: ShieldCheck },
];
export const TITLES: Record<string, string> = { '': 'Home', chains: 'All chains', send: 'Send', receive: 'Receive', swap: 'Swap', bridge: 'Bridge', private: 'Private send', activity: 'Activity', security: 'Keys & guardians', qday: 'Q-Day switch', drill: 'Steal-the-key drill' };

/** Kept for older imports: the mark as the send-tab icon. */
export const ShieldSend = ({ size = 26 }: { size?: number }) => <Mark size={size} glow={false} />;

export function AppShell({ route, children }: { route: string; children: ReactNode }) {
  const { vault, account, live, lock, readOnly } = useWallet();
  const migrated = live?.status?.migrated;
  const status = !live ? 'Loading…' : migrated ? 'Quantum-only key on' : live.status ? 'Two locks on' : 'Plain account';
  return <div className="app">
    <aside className="side">
      <Brand />
      <a className="acct-switch" href={readOnly ? '#/start' : '#/app/security'}>
        <span className="avatar">{account[0].toUpperCase()}</span>
        <span className="who"><b>{readOnly ? DEMO.label : short(account, 18, 8)}</b><small>{readOnly ? short(account, 16, 8) : status}</small></span>
        <ChevronRight size={16} color="var(--text-3)" />
      </a>
      <nav className="side-nav">
        {NAV.map(n => <a key={n.to} href={`#/app${n.to ? '/' + n.to : ''}`} className={route === n.to ? 'on' : ''}><n.icon size={18} />{n.label}</a>)}
        <span className="side-label">Protection</span>
        {PROTECT.map(n => <a key={n.to} href={`#/app/${n.to}`} className={route === n.to ? 'on' : ''}><n.icon size={18} />{n.label}{n.to === 'qday' && <span className={`badge pill ${migrated ? 'pill-green' : 'pill-gray'}`}>{migrated ? 'On' : 'Off'}</span>}</a>)}
      </nav>
      <div className="side-foot">
        <span className="netline"><span className="live-dot" />NEAR testnet</span>
        {vault ? <button className="btn btn-light btn-sm" onClick={lock}><Lock size={15} /> Lock wallet</button>
          : <a className="btn btn-primary btn-sm" href="#/start"><LockOpen size={15} /> Create or unlock</a>}
      </div>
    </aside>
    <div className="main">
      <header className="top"><h1>{TITLES[route] ?? ''}</h1>
        <div className="top-right">
          <span className={`pill ${readOnly ? 'pill-gray' : 'pill-green'}`}><span className="dot" />{readOnly ? 'Demo · view only' : 'Unlocked'}</span>
          <span className="pill pill-green">{status}</span>
        </div>
      </header>
      <header className="mtop">
        <Brand size={26} />
        <div className="mtop-right">
          <span className={`pill ${readOnly ? 'pill-gray' : 'pill-green'}`}>{readOnly ? 'Demo' : 'Unlocked'}</span>
          {vault ? <button className="btn btn-light btn-sm" aria-label="Lock wallet" onClick={lock} style={{ padding: '0 10px' }}><Lock size={15} /></button>
            : <a className="btn btn-primary btn-sm" href="#/start">Start</a>}
        </div>
      </header>
      <main className="page"><motion.div key={route} className="page-anim" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .4, ease: [0.2, 0.7, 0.2, 1] }}>{children}</motion.div></main>
      <nav className="tabbar" aria-label="Wallet">
        {TABS.map(t => <a key={t.to} href={`#/app${t.to ? '/' + t.to : ''}`} aria-label={t.label} aria-current={route === t.to ? 'page' : undefined} className={route === t.to ? 'on' : ''}>
          {t.to === 'send' ? <span className="fab"><ArrowUpRight size={22} /></span> : <t.icon size={22} strokeWidth={route === t.to ? 2.1 : 1.6} />}
        </a>)}
      </nav>
    </div>
  </div>;
}
