import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../../../web/src/styles.css';
import './ext.css';
import { WalletProvider, useWallet } from '../../../web/src/lib/store.tsx';
import { AppShell } from '../../../web/src/pages/AppShell.tsx';
import { Dashboard } from '../../../web/src/pages/Dashboard.tsx';
import { Send } from '../../../web/src/pages/Send.tsx';
import { Receive } from '../../../web/src/pages/Receive.tsx';
import { Activity } from '../../../web/src/pages/Activity.tsx';
import { Security } from '../../../web/src/pages/Security.tsx';
import { QDay } from '../../../web/src/pages/QDay.tsx';
import { Drill } from '../../../web/src/pages/Drill.tsx';
import { Chains } from '../../../web/src/pages/Chains.tsx';
import { PrivateSend } from '../../../web/src/pages/PrivateSend.tsx';
import { Swap } from '../../../web/src/pages/Swap.tsx';
import { Start } from '../../../web/src/pages/Start.tsx';
import { Boundary } from '../../../web/src/ui/bits.tsx';

function Popup() {
  const [hash, setHash] = useState(location.hash);
  const { ready, vault, hasBackup, toast } = useWallet();
  useEffect(() => { const f = () => { setHash(location.hash); scrollTo(0, 0); }; addEventListener('hashchange', f); return () => removeEventListener('hashchange', f); }, []);
  useEffect(() => { if (ready && !location.hash) location.hash = vault ? '#/app' : hasBackup ? '#/start/unlock' : '#/start'; }, [ready]);
  if (!ready) return null;
  const path = hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  if (path[0] === 'start') return <Start key={hash} mode={(path[1] as any) ?? 'choose'} account={path[2] ?? ''} />;
  const r = path[0] === 'app' ? path[1] ?? '' : '';
  const P = ({ '': Dashboard, send: Send, receive: Receive, activity: Activity, security: Security, qday: QDay, drill: Drill, chains: Chains, private: PrivateSend, swap: Swap } as any)[r] ?? Dashboard;
  return <><AppShell route={r}><Boundary key={r}><P /></Boundary></AppShell>{toast && <div className="toast">{toast}</div>}</>;
}
createRoot(document.getElementById('root')!).render(<StrictMode><WalletProvider><Popup /></WalletProvider></StrictMode>);
