import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import { WalletProvider, useWallet } from './lib/store.tsx';
import { Landing } from './pages/Landing.tsx';
import { AppShell } from './pages/AppShell.tsx';
import { Dashboard } from './pages/Dashboard.tsx';
import { Send } from './pages/Send.tsx';
import { Receive } from './pages/Receive.tsx';
import { Activity } from './pages/Activity.tsx';
import { Security } from './pages/Security.tsx';
import { QDay } from './pages/QDay.tsx';
import { Drill } from './pages/Drill.tsx';
import { Chains } from './pages/Chains.tsx';
import { PrivateSend } from './pages/PrivateSend.tsx';
import { Swap } from './pages/Swap.tsx';
import { Start } from './pages/Start.tsx';
import { Boundary } from './ui/bits.tsx';

const useHash = () => {
  const [h, set] = useState(location.hash);
  useEffect(() => { const f = () => { set(location.hash); window.scrollTo(0, 0); }; addEventListener('hashchange', f); return () => removeEventListener('hashchange', f); }, []);
  return h;
};

function Router() {
  const hash = useHash();
  const { toast } = useWallet();
  const path = hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  let page;
  if (path[0] === 'app') {
    const r = path[1] ?? '';
    const P = ({ '': Dashboard, send: Send, receive: Receive, activity: Activity, security: Security, qday: QDay, drill: Drill, chains: Chains, private: PrivateSend, swap: Swap } as any)[r] ?? Dashboard;
    page = <AppShell route={r}><Boundary key={r}><P /></Boundary></AppShell>;
  } else if (path[0] === 'start') {
    page = <Start key={hash} mode={(path[1] as any) ?? 'choose'} account={path[2] ? decodeURIComponent(path[2]) : ''} />;
  } else if (path[0] === 'scan') {
    page = <Landing key={hash} initial={decodeURIComponent(path[1] ?? '')} />;
  } else if (['home', 'send', 'receive', 'activity', 'security', 'unlock', 'create'].includes(path[0])) {
    location.replace('#/app'); return null;
  } else page = <Landing />;
  return <>{page}{toast && <div className="toast" role="status">{toast}</div>}</>;
}

createRoot(document.getElementById('root')!).render(<StrictMode><WalletProvider><Router /></WalletProvider></StrictMode>);
