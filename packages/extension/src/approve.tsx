import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { KeyRound, Atom, Check, ShieldCheck, ShieldAlert, LockOpen, Link2 } from 'lucide-react';
import '../../../web/src/styles.css';
import './ext.css';
import { WalletProvider, useWallet, feeSigner } from '../../../web/src/lib/store.tsx';
import { friendlyError, near } from '../../../web/src/lib/chain.ts';
import { Spinner, TxLink } from '../../../web/src/ui/bits.tsx';
import { base64, execute, makeIntent, signIntent, utf8, view, type Action } from '../../../sdk/index.ts';

declare const chrome: any;
const S = chrome.storage.session;
type Req = { id: string; origin: string; method: 'connect' | 'signAndSendTransaction'; params: any };

/** wallet-selector style transaction -> one Magen intent action (one action per request). */
function toAction(tx: any): Action {
  if (!tx?.receiverId || !Array.isArray(tx.actions) || tx.actions.length !== 1) throw Error('Magen signs exactly one action per request.');
  const a = tx.actions[0], p = a.params ?? {};
  if (a.type === 'Transfer') return { kind: 'send', receiver: tx.receiverId, amount: String(p.deposit) };
  if (a.type === 'FunctionCall') return { kind: 'call', receiver: tx.receiverId, method: p.methodName, args: base64.encode(utf8(JSON.stringify(p.args ?? {}))), deposit: String(p.deposit ?? '0') };
  throw Error(`Magen does not sign ${a.type} actions.`);
}

function Approve() {
  const { ready, vault, unlock, hasBackup, live } = useWallet();
  const [req, setReq] = useState<Req | null>(null); const [err, setErr] = useState(''); const [busy, setBusy] = useState('');
  const [pw, setPw] = useState(''); const [signed, setSigned] = useState(false);
  const [res, setRes] = useState<{ hash: string; success: boolean; error: string } | null>(null);
  const id = location.hash.slice(1);
  useEffect(() => { S.get(`req-${id}`).then((r: any) => r[`req-${id}`] ? setReq(r[`req-${id}`]) : setErr('This request has expired.')); }, []);
  const answer = (v: any) => S.set({ [`res-${id}`]: v });
  const reject = async () => { await answer({ error: 'The user rejected the request.' }); window.close(); };
  let action: Action | null = null, actionErr = '';
  if (req?.method === 'signAndSendTransaction') { try { action = toAction(req.params); } catch (e: any) { actionErr = e.message; } }

  const approve = async () => {
    if (!vault || !req) return; setErr('');
    try {
      if (req.method === 'connect') {
        const { connected = {} } = await chrome.storage.local.get('connected');
        connected[req.origin] = vault.wallet; await chrome.storage.local.set({ connected });
        await answer({ result: { accountId: vault.wallet } }); setTimeout(() => window.close(), 600); return;
      }
      setBusy('Signing with ed25519 and ML-DSA-65…');
      const s = await view(vault.wallet);
      const intent = makeIntent(vault.wallet, s.nonce, action!);
      await new Promise(r => setTimeout(r, 30));
      const both = signIntent(intent, vault.keys); setSigned(true);
      setBusy('NEAR is checking both signatures…');
      const r = await execute(feeSigner(vault, live), vault.wallet, both);
      setRes(r);
      await answer({ result: { transactionHash: r.hash, success: r.success, error: r.success ? '' : friendlyError(r.error) } });
      setTimeout(() => window.close(), 6000);
    } catch (e: any) { setErr(friendlyError(String(e.message))); await answer({ error: friendlyError(String(e.message)) }); } finally { setBusy(''); }
  };
  if (!ready) return null;
  const host = req ? req.origin.replace(/^https?:\/\//, '') : '';
  return <div className="approve">
    <div className="approve-top"><span className="brand"><img src="./art/icon.webp" alt="" />magen</span><span className="pill pill-ink"><span className="dot" style={{ color: '#3ad29f' }} />NEAR testnet</span></div>
    <div className="approve-body">
      {req && <div className="site"><span className="site-ico">{host[0]?.toUpperCase()}</span><span><b>{host}</b><small>{req.origin}</small></span></div>}
      {req?.method === 'connect' && <><div className="ask">Connect this site to your Magen wallet?</div><p className="hint" style={{ fontSize: 14 }}>It will see your account name and can ask you to approve payments. It can never sign anything itself.</p></>}
      {action && <>
        <div className="ask">{action.kind === 'send' ? 'Send' : `Call ${(action as any).method}`}</div>
        {action.kind === 'send' && <div className="ask-amt">{near(action.amount, 4)}<small>NEAR</small></div>}
        <div className="summary card card-pad" style={{ padding: 14 }}>
          <div><span>To</span><b className="mono">{action.kind !== 'migrate' && (action as any).receiver}</b></div>
          {action.kind === 'call' && <div><span>Deposit</span><b>{near(action.deposit, 4)} NEAR</b></div>}
          <div><span>From</span><b className="mono">{vault?.wallet ?? '—'}</b></div>
        </div>
        <div className="twice">
          <h3><ShieldCheck size={17} />Signed twice: classical + quantum-safe</h3>
          <div className="sig"><span className="lock-ico"><KeyRound size={16} /></span><span><b>ed25519</b><small>{signed ? '64 bytes · signed' : 'classical signature'}</small></span>{signed && <Check size={17} color="#3ad29f" />}</div>
          <div className="sig"><span className="lock-ico pq"><Atom size={16} /></span><span><b>ML-DSA-65</b><small>{signed ? '3,309 bytes · signed' : 'post-quantum signature'}</small></span>{signed && <Check size={17} color="#3ad29f" />}</div>
          <small style={{ color: 'var(--on-ink-3)', fontSize: 12.5, lineHeight: 1.5 }}>Your wallet contract verifies both on chain. Either one missing or wrong, nothing moves.</small>
        </div>
      </>}
      {actionErr && <div className="banner banner-red"><ShieldAlert size={18} /><div>{actionErr}</div></div>}
      {!vault && req && <div className="card card-pad" style={{ display: 'grid', gap: 10, padding: 16 }}>
        <b style={{ display: 'flex', gap: 8, alignItems: 'center' }}><LockOpen size={17} />Unlock Magen to answer</b>
        {hasBackup ? <><input className="input" type="password" placeholder="Password" value={pw} onChange={e => setPw(e.target.value)} onKeyDown={e => e.key === 'Enter' && unlock(pw).catch(x => setErr(x.message))} autoFocus />
          <button className="btn btn-dark" onClick={() => unlock(pw).catch(x => setErr(x.message))} disabled={!pw}>Unlock</button></>
          : <p className="hint">No wallet in this browser yet. Open the Magen popup to upgrade an account first.</p>}
      </div>}
      {res && (res.success ? <div className="result ok"><h3><ShieldCheck size={20} color="var(--green)" />Sent. Both signatures verified on chain.</h3><TxLink hash={res.hash} label="View transaction" /></div>
        : <div className="result bad"><h3><ShieldAlert size={20} color="var(--red)" />{friendlyError(res.error)}</h3><TxLink hash={res.hash} label="View the refusal" /></div>)}
      {err && <div className="banner banner-red"><ShieldAlert size={18} /><div>{err}</div></div>}
    </div>
    {req && !res && <div className="approve-foot">
      <button className="btn btn-light" onClick={reject} disabled={!!busy}>Reject</button>
      <button className="btn btn-primary" onClick={approve} disabled={!vault || !!busy || !!actionErr}>{busy ? <><Spinner />{busy.split('…')[0].length > 22 ? 'Working…' : busy}</> : req.method === 'connect' ? <><Link2 size={17} />Connect</> : 'Approve · sign twice'}</button>
    </div>}
  </div>;
}
createRoot(document.getElementById('root')!).render(<StrictMode><WalletProvider><Approve /></WalletProvider></StrictMode>);
