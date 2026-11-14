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
import { Bridge } from './pages/Bridge.tsx';
/** Wallet screens shared by the web app and the extension popup. */
export const PAGES: Record<string, () => any> = { '': Dashboard, send: Send, receive: Receive, activity: Activity, security: Security, qday: QDay, drill: Drill, chains: Chains, private: PrivateSend, swap: Swap, bridge: Bridge };
