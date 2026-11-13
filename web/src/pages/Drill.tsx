import { useEffect, useRef, useState } from 'react';
import { Crosshair, ShieldAlert, ShieldCheck, Check, Eye, Cpu, Zap, RotateCcw, FlaskConical, KeyRound, Atom } from 'lucide-react';
import { base64, keyString, random } from '../../../sdk/index.ts';
import { DRILL_SPACE } from '../../../sdk/drill.ts';
import { attackMagen, balanceOf, spendableOf, createWithHelper, drainPlain, prepareDrill, readTargets, type DrillState } from '../../../sdk/drillflow.ts';
import { crackInBrowser } from '../lib/crack.ts';
import { friendlyError, near, short, txUrl } from '../lib/chain.ts';
import { Spinner } from '../ui/bits.tsx';

const KEY = 'magen-drill';
type Run = {
  phase: 'idle' | 'reading' | 'cracking' | 'attacking' | 'done'; targets?: { account: string; publicKey: string; permission: string }[];
  checked: number; ms: number; found?: number[]; drain?: { hash: string; success: boolean; error?: string }; magen?: { hash: string; success: boolean; error: string }; error?: string;
};
const load = (): (DrillState & { run?: Run }) | null => { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { return null; } };

export function Drill() {
  const [st, setSt] = useState(load);
  const [bal, setBal] = useState<{ plain: bigint | null; magen: bigint | null; attacker: bigint | null } | null>(null);
  const [setup, setSetup] = useState<string[]>([]); const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const [run, setRun] = useState<Run>(st?.run ?? { phase: 'idle', checked: 0, ms: 0 });
  const t0 = useRef(0);
  const save = (s: DrillState & { run?: Run }) => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch {} setSt({ ...s }); };
  const readBalances = async (s = st) => { if (!s) return; const [plain, magen, attacker] = await Promise.all([spendableOf(s.plain.account), spendableOf(s.magen.account), balanceOf(s.attacker.account)]); setBal({ plain, magen, attacker }); };
  useEffect(() => { readBalances(); }, [st?.funder.account]);

  const prepare = async () => {
    setErr(''); setBusy(true); setSetup([]); setBal(null); setRun({ phase: 'idle', checked: 0, ms: 0 });
    const log = (s: string) => setSetup(l => [...l, s]);
    try {
      const funder = { account: `drill-${Date.now().toString(36)}.testnet`, seed: base64.encode(random()) };
      log(`Asking the testnet helper for ${funder.account}`);
      await createWithHelper(funder.account, keyString(funder));
      const wasm = new Uint8Array(await (await fetch('/wallet.wasm')).arrayBuffer());
      const s = await prepareDrill(funder, wasm, (step, d) => log(`${step[0].toUpperCase()}${step.slice(1)} · ${d}`));
      save(s); log('Ready. Both accounts hold the same amount behind one weak classical key.');
      await new Promise(r => setTimeout(r, 2500)); await readBalances(s);
    } catch (e: any) { setErr(friendlyError(String(e.message))); } finally { setBusy(false); }
  };

  const attack = async () => {
    if (!st) return; setErr('');
    let r: Run = { phase: 'reading', checked: 0, ms: 0 }; const put = (p: Partial<Run>) => { r = { ...r, ...p }; setRun(r); };
    put({});
    try {
      const targets = await readTargets(st);
      put({ phase: 'cracking', targets: targets.map(t => ({ account: t.account, publicKey: t.publicKey, permission: t.permission })) });
      t0.current = performance.now();
      const found = await crackInBrowser(targets.map(t => t.bytes), n => put({ checked: n, ms: performance.now() - t0.current }));
      if (found.length < 2) throw Error('The attacker did not find both keys in the drill space.');
      const idx = [0, 1].map(t => found.find(f => f.target === t)!.index);
      put({ phase: 'attacking', found: idx, ms: performance.now() - t0.current });
      const drain = await drainPlain(st, idx[0]);
      put({ drain }); readBalances();
      const m = await attackMagen(st, idx[1]);
      put({ magen: m, phase: 'done' });
      save({ ...st, run: r });
      setTimeout(() => readBalances(), 2500);
    } catch (e: any) { put({ error: friendlyError(String(e.message)), phase: 'idle' }); }
  };

  const drained = !!run.drain?.success;
  const refused = run.magen && !run.magen.success;
  const pct = Math.min(100, (run.checked / DRILL_SPACE) * 100);
  const rate = run.ms > 0 ? Math.round(run.checked / (run.ms / 1000)) : 0;
  return <>
    <h1 className="page-title-m only-m">Key-recovery drill</h1>
    <div className="drill-label">
      <span className="pill pill-amber"><FlaskConical size={13} />Simulated key compromise</span>
      <span>Classical keys weakened on purpose to {DRILL_SPACE.toLocaleString()} possibilities so this laptop can play the quantum computer. Real transactions on NEAR testnet.</span>
    </div>
    <div className="arena">
      <section className={`victim rise ${drained ? 'drained' : ''}`}>
        <div className="victim-top"><span className="lock-ico"><KeyRound size={18} /></span><b>Plain NEAR account</b><span className="pill pill-gray">1 key</span></div>
        <span className="who mono">{st?.plain.account ?? 'Not set up yet'}</span>
        <div className="num">{drained ? '0.00' : bal ? near(bal.plain, 2) : '—'}<small>NEAR</small></div>
        <div className="lockline"><span className="pill pill-red">ed25519 · full access</span></div>
        {drained ? <div className="verdict bad"><b>Drained</b><span>The recovered key sent everything to the attacker and closed the account.</span><a href={txUrl(run.drain!.hash)} target="_blank" rel="noreferrer">Transaction {short(run.drain!.hash)}</a></div>
          : <div className="verdict" style={{ background: 'var(--bg)', color: 'var(--text-2)' }}>One classical key controls everything.</div>}
      </section>
      <section className={`victim magen rise ${refused ? 'held' : ''}`}>
        <img className="art" src="/art/lattice-lock.webp" alt="" />
        <div className="victim-top"><span className="lock-ico pq"><Atom size={18} /></span><b>Magen account</b></div>
        <span className="who mono">{st?.magen.account ?? 'Not set up yet'}</span>
        <div className="num">{bal ? near(bal.magen, 2) : '—'}<small>NEAR</small></div>
        <div className="lockline"><span className="pill pill-ink">ed25519 · execute only</span><span className="pill pill-ink" style={{ color: '#b9c8ff' }}>+ ML-DSA-65</span></div>
        {refused ? <div className="verdict good"><b>Refused on chain: quantum half missing</b><span>Same stolen key, valid classical signature. The contract asked for the second lock.</span><a href={txUrl(run.magen!.hash)} target="_blank" rel="noreferrer">Transaction {short(run.magen!.hash)}</a></div>
          : <div className="verdict" style={{ background: 'rgba(255,255,255,.06)', color: 'var(--on-ink-2)' }}>Upgraded in place: the same kind of key, plus a second lock.</div>}
      </section>
    </div>
    <section className="attacker rise">
      <div className="attacker-head">
        <span className="lock-ico" style={{ background: 'rgba(255,107,111,.15)', color: '#ff8a8e' }}><Crosshair size={18} /></span>
        <span><b>Attacker</b><br /><small style={{ color: 'var(--on-ink-3)' }}>{st ? `Owns ${short(st.attacker.account, 22, 10)}${bal?.attacker != null ? ` · ${near(bal.attacker, 2)} NEAR` : ''}` : 'Set up a drill to start'}</small></span>
        {!st || run.phase === 'done' ? <button className="btn btn-ghost-dark" onClick={prepare} disabled={busy}>{busy ? <Spinner /> : <RotateCcw size={16} />}{st ? 'Set up a fresh drill' : 'Set up the drill'}</button>
          : <button className="btn btn-danger" onClick={attack} disabled={run.phase !== 'idle'}>{run.phase === 'idle' ? <><Zap size={16} />Run the attacker</> : <><Spinner />Attacking…</>}</button>}
      </div>
      {busy || (setup.length > 0 && !st) ? <div className="step active"><h4><Spinner />Setting up on NEAR testnet</h4>{setup.map((s, i) => <span key={i} className="mono">{s}</span>)}</div> : null}
      <div className="steps">
        <div className={`step ${run.phase === 'reading' ? 'active' : run.targets ? 'done' : ''}`}>
          <h4>{run.targets ? <Check size={15} /> : <Eye size={15} />}Read public keys from NEAR</h4>
          {run.targets ? run.targets.map(t => <span key={t.account} className="mono">{short(t.account, 12, 18)}: {short(t.publicKey, 14, 4)} · {t.permission}</span>) : <span>Anyone can call view_access_key_list. No secrets needed.</span>}
        </div>
        <div className={`step ${run.phase === 'cracking' ? 'active' : run.found ? 'done' : ''}`}>
          <h4>{run.found ? <Check size={15} /> : <Cpu size={15} />}Recover the private keys</h4>
          <div className="prog"><i style={{ width: `${run.found ? 100 : pct}%` }} /></div>
          <span>{run.found ? `Both keys found in ${(run.ms / 1000).toFixed(1)} s (seeds #${run.found[0].toLocaleString()} and #${run.found[1].toLocaleString()}).`
            : run.checked ? `${run.checked.toLocaleString()} of ${DRILL_SPACE.toLocaleString()} tried · ${rate.toLocaleString()} keys/s` : 'Tries every seed in the weakened space.'}</span>
        </div>
        <div className={`step ${run.phase === 'attacking' ? 'active' : run.phase === 'done' ? 'done' : ''}`}>
          <h4>{run.phase === 'done' ? <Check size={15} /> : <Zap size={15} />}Spend with the stolen keys</h4>
          <span>{run.drain ? (run.drain.success ? 'Plain account: drained.' : 'Plain account: failed.') : 'Sign a transfer to the attacker from each account.'}</span>
          {run.magen && <span>{run.magen.success ? 'Magen account: spent (unexpected).' : `Magen account: ${friendlyError(run.magen.error).replace('Refused on chain: ', 'refused, ')}`}</span>}
        </div>
      </div>
      {(err || run.error) && <div className="banner banner-red"><ShieldAlert size={18} /><div>{err || run.error}</div></div>}
      {run.phase === 'done' && <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <ShieldCheck size={18} color="#8fa8ff" /><span style={{ fontSize: 14, color: 'var(--on-ink-2)' }}>Next: the owner can flip the Q-Day switch so a native ML-DSA-65 key takes over.</span>
        <a className="link" href="#/app/qday" style={{ color: '#8fa8ff' }}>Q-Day switch</a>
      </div>}
    </section>
  </>;
}
