import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../../../web/src/styles.css';
import './ext.css';
import { WalletProvider, useWallet } from '../../../web/src/lib/store.tsx';
import { AppShell } from '../../../web/src/pages/AppShell.tsx';
import { Start } from '../../../web/src/pages/Start.tsx';
import { PAGES } from '../../../web/src/routes.tsx';
import { Boundary } from '../../../web/src/ui/bits.tsx';

function Popup() {
  const [hash, setHash] = useState(location.hash);
  const { ready, vault, hasBackup, toast } = useWallet();
  useEffect(() => { const f = () => { setHash(location.hash); scrollTo(0, 0); }; addEventListener('hashchange', f); return () => removeEventListener('hashchange', f); }, []);
  useEffect(() => { if (ready && !location.hash) location.hash = hasBackup && !vault ? '#/start/unlock' : '#/app'; }, [ready]);
  if (!ready) return null;
  const path = hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  if (path[0] === 'start') return <Start key={hash} mode={(path[1] as any) ?? 'choose'} account={path[2] ?? ''} />;
  const r = path[0] === 'app' ? path[1] ?? '' : '';
  const P = PAGES[r] ?? PAGES[''];
  return <><AppShell route={r}><Boundary key={r}><P /></Boundary></AppShell>{toast && <div className="toast">{toast}</div>}</>;
}
createRoot(document.getElementById('root')!).render(<StrictMode><WalletProvider><Popup /></WalletProvider></StrictMode>);
