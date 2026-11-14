import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import { WalletProvider, useWallet } from './lib/store.tsx';
import { Landing } from './pages/Landing.tsx';
import { AppShell } from './pages/AppShell.tsx';
import { Start } from './pages/Start.tsx';
import { PAGES } from './routes.tsx';
import { Boundary } from './ui/bits.tsx';

const useHash = () => {
  const [h, set] = useState(location.hash);
  useEffect(() => { const f = () => { const h = location.hash; if (h && !h.startsWith('#/')) { document.getElementById(h.slice(1))?.scrollIntoView({ behavior: 'smooth' }); return; } set(h); window.scrollTo(0, 0); }; addEventListener('hashchange', f); return () => removeEventListener('hashchange', f); }, []);
  return h;
};

function Router() {
  const hash = useHash();
  const { toast } = useWallet();
  const path = (hash.startsWith('#/') ? hash : '').replace(/^#\/?/, '').split('/').filter(Boolean);
  let page;
  if (path[0] === 'app') {
    const r = path[1] ?? '';
    const P = PAGES[r] ?? PAGES[''];
    page = <AppShell route={r}><Boundary key={r}><P /></Boundary></AppShell>;
  } else if (path[0] === 'start') {
    page = <Start key={hash} mode={(path[1] as any) ?? 'choose'} account={path[2] ? decodeURIComponent(path[2]) : ''} />;
  } else if (path[0] === 'scan') {
    page = <Landing />;
  } else if (['home', 'send', 'receive', 'activity', 'security', 'unlock', 'create'].includes(path[0])) {
    location.replace('#/app'); return null;
  } else page = <Landing />;
  return <>{page}{toast && <div className="toast" role="status">{toast}</div>}</>;
}

createRoot(document.getElementById('root')!).render(<StrictMode><WalletProvider><Router /></WalletProvider></StrictMode>);
