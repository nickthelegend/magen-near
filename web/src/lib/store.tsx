import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { openVault, sealVault, type Vault } from '../../../sdk/index.ts';
import { readAccount, readKeys, readStatus, type AccountView, type KeyInfo } from './chain.ts';
import { getBackup, getSession, setBackup, setSession } from './platform.ts';

/** The public demo account shown read-only until a wallet is unlocked. */
export const DEMO = { account: 'magen.drill-mwf4jsnn.testnet', label: 'Demo account' };

type Live = { account: AccountView | null; keys: KeyInfo[]; status: Awaited<ReturnType<typeof readStatus>>; loadedAt: number; error?: string };
type Ctx = {
  vault: Vault | null; account: string; readOnly: boolean; live: Live | null; refresh: () => Promise<void>;
  unlock: (password: string, file?: any) => Promise<void>; lock: () => void; adopt: (v: Vault, password: string) => Promise<any>;
  hasBackup: boolean; backup: () => any; ready: boolean; toast: string; notify: (s: string) => void;
};
const C = createContext<Ctx>(null as any);
export const useWallet = () => useContext(C);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [vault, setVault] = useState<Vault | null>(null);
  const [live, setLive] = useState<Live | null>(null);
  const [toast, setToast] = useState('');
  const [backupData, setBackupData] = useState<any>(null);
  const [ready, setReady] = useState(false);
  const hasBackup = !!backupData;
  useEffect(() => { Promise.all([getBackup(), getSession()]).then(([b, v]) => { setBackupData(b); if (v) setVault(v); setReady(true); }); }, []);
  const account = vault?.wallet ?? DEMO.account;
  const refresh = useCallback(async () => {
    try {
      const [a, k, s] = await Promise.all([readAccount(account), readKeys(account).catch(() => []), readStatus(account)]);
      setLive({ account: a, keys: k, status: s, loadedAt: Date.now() });
    } catch (e: any) { setLive(l => ({ ...(l ?? { account: null, keys: [], status: null }), loadedAt: Date.now(), error: 'NEAR RPC did not answer. Retrying shortly.' })); }
  }, [account]);
  useEffect(() => { setLive(null); refresh(); const t = setInterval(refresh, 15000); return () => clearInterval(t); }, [refresh]);
  const notify = useCallback((s: string) => { setToast(s); setTimeout(() => setToast(''), 3600); }, []);
  const value = useMemo<Ctx>(() => ({
    vault, account, readOnly: !vault, live, refresh, toast, notify, hasBackup, ready,
    backup: () => backupData,
    unlock: async (password, file) => {
      const b = file ?? backupData;
      if (!b) throw Error('No encrypted backup on this device. Choose your backup file.');
      const v = await openVault(b, password);
      if (file) { await setBackup(file); setBackupData(file); }
      await setSession(v); setVault(v);
    },
    lock: () => { setSession(null); setVault(null); },
    adopt: async (v, password) => {
      const sealed = await sealVault(v, password);
      await setBackup(sealed); setBackupData(sealed); await setSession(v); setVault(v); return sealed;
    },
  }), [vault, account, live, refresh, toast, notify, backupData, ready]);
  return <C.Provider value={value}>{children}</C.Provider>;
}

export function downloadJson(data: any, name: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
