import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, ShieldCheck, Sparkles, LockOpen, ChevronRight, ShieldAlert, FileUp, Eye, KeyRound, Atom, Check, RotateCcw } from 'lucide-react';
import { base64, keyString, random, sealVault, view } from '../../../sdk/index.ts';
import { precheckUpgrade, seedFromPhrase, seedFromPrivateKey, upgradeInPlace, edKeyString } from '../../../sdk/upgrade.ts';
import { createWithHelper } from '../../../sdk/drillflow.ts';
import { newMnemonic, validMnemonic, magenKeysFromMnemonic, deriveAll, nearKey } from '../../../sdk/hd.ts';
import { publicKeys } from '../../../sdk/index.ts';
import { useWallet, downloadJson } from '../lib/store.tsx';
import { friendlyError, near, readAccount } from '../lib/chain.ts';
import { Spinner, TxLink } from '../ui/bits.tsx';
import { Brand, Mark } from '../ui/Logo.tsx';
import { ChainLogo } from '../ui/chain.tsx';
import { shortAddr } from '../lib/multi.ts';

type Mode = 'choose' | 'create' | 'restore' | 'upgrade' | 'unlock';

export function Start({ mode: initial = 'choose', account: preset = '' }: { mode?: Mode; account?: string }) {
  const { hasBackup } = useWallet();
  const [mode, setMode] = useState<Mode>(initial);
  return <div className="start">
    <aside className="start-art">
      <Brand />
      <div style={{ display: 'grid', placeItems: 'center', flex: 1 }}><div style={{ filter: 'drop-shadow(0 0 60px rgba(224,64,200,.35))' }}><Mark size={220} /></div></div>
      <p>One seed. Every chain. A quantum-safe key from day one.</p>
    </aside>
    <main className="start-main"><div className="start-box rise">
      <span className="only-m"><Brand /></span>
      {mode === 'choose' && <>
        <div><h1>Welcome to Magen.</h1><p className="lede" style={{ fontSize: 15.5, marginTop: 6 }}>NEAR testnet. Your keys are made and kept on this device.</p></div>
        <div className="choices">
          <button className="choice primary" onClick={() => setMode('create')}><span className="ci"><Sparkles size={22} /></span><span><b>Create a new wallet</b><small>12 words, every chain, a quantum-safe key.</small></span><ChevronRight size={18} /></button>
          <button className="choice" onClick={() => setMode(hasBackup ? 'unlock' : 'restore')}><span className="ci"><LockOpen size={22} /></span><span><b>{hasBackup ? 'Unlock my wallet' : 'I have 12 words'}</b><small>{hasBackup ? 'Your encrypted wallet is on this device.' : 'Restore a Magen wallet.'}</small></span><ChevronRight size={18} /></button>
          <button className="choice" onClick={() => setMode('upgrade')}><span className="ci"><ShieldCheck size={22} /></span><span><b>Upgrade a NEAR account</b><small>Keep its name and balance, add the second lock.</small></span><ChevronRight size={18} /></button>
        </div>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}><a className="link" href="#/app">Look around the demo wallet</a>{hasBackup && <button className="link" onClick={() => setMode('restore')}>Restore with 12 words</button>}{!hasBackup && <button className="link" onClick={() => setMode('unlock')}>Unlock a backup file</button>}</div>
      </>}
      {mode === 'create' && <Create back={() => setMode('choose')} />}
      {mode === 'restore' && <Restore back={() => setMode('choose')} />}
      {mode === 'upgrade' && <Upgrade preset={preset} back={() => setMode('choose')} />}
      {mode === 'unlock' && <Unlock back={() => setMode('choose')} />}
    </div></main>
  </div>;
}

function Phrase({ words, hidden, onReveal }: { words: string[]; hidden: boolean; onReveal?: () => void }) {
  return <div className={`phrase ${hidden ? 'hidden' : ''}`}>
    {words.map((w, i) => <span key={i}><i>{i + 1}</i>{w}</span>)}
    {hidden && <button className="phrase-cover" onClick={onReveal}><Eye size={22} />Tap to reveal<small className="card-sub">Make sure no one is watching</small></button>}
  </div>;
}

function Create({ back }: { back: () => void }) {
  const { adopt } = useWallet();
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [taken, setTaken] = useState<boolean | null>(null);
  const [phrase] = useState(() => newMnemonic());
  const words = phrase.split(' ');
  const [hidden, setHidden] = useState(true);
  const [saved, setSaved] = useState(false);
  const [pw, setPw] = useState(''); const [pw2, setPw2] = useState('');
  const [busy, setBusy] = useState(''); const [err, setErr] = useState('');
  const [done, setDone] = useState<{ hash: string; account: string } | null>(null);
  const derived = useMemo(() => step >= 2 ? deriveAll(phrase) : null, [step, phrase]);
  const id = `${name}.testnet`;
  useEffect(() => {
    setTaken(null); if (!/^[a-z0-9][a-z0-9-]{2,30}$/.test(name)) return;
    let on = true; const t = setTimeout(() => readAccount(id).then(a => on && setTaken(!!a)).catch(() => {}), 300);
    return () => { on = false; clearTimeout(t); };
  }, [name]);
  const create = async () => {
    setErr('');
    try {
      if (pw.length < 10) throw Error('Use a password of at least 10 characters.');
      if (pw !== pw2) throw Error('The two passwords don’t match.');
      const mk = magenKeysFromMnemonic(phrase); const n = nearKey(phrase);
      setBusy(`Creating ${id} on NEAR testnet…`);
      await createWithHelper(id, n.publicKey);
      setBusy('Adding your two locks…');
      const wasm = new Uint8Array(await (await fetch('/wallet.wasm')).arrayBuffer());
      const up = await upgradeInPlace(id, n.seed, wasm, [n.publicKey], mk.keys.pq, undefined, 'ml-dsa', undefined, mk.feeSeed);
      if (!up.result.success) throw Error(friendlyError(up.result.error));
      setBusy('Encrypting your wallet on this device…');
      await adopt({ wallet: id, keys: up.keys, relay: up.fee, mnemonic: phrase }, pw);
      setDone({ hash: up.result.hash, account: id });
    } catch (e: any) { setErr(friendlyError(String(e.message))); } finally { setBusy(''); }
  };
  if (done) return <>
    <div className="result ok"><h3><ShieldCheck size={24} color="var(--mint)" />{done.account} is ready.</h3><p>Two locks on NEAR, an address on every chain, all from your 12 words.</p><TxLink hash={done.hash} label="View the creation transaction" /></div>
    <a className="btn btn-primary btn-lg btn-block" href="#/app">Open my wallet <ArrowRight size={18} /></a>
  </>;
  return <>
    <button className="backstep" onClick={() => step ? setStep(step - 1) : back()}><ArrowLeft size={16} />Back</button>
    <div className="prog"><i style={{ width: `${(step + 1) * 25}%` }} /></div>
    {step === 0 && <>
      <div><h1>Pick a name.</h1><p className="lede" style={{ fontSize: 15.5, marginTop: 6 }}>Your NEAR address. People send to it like an email.</p></div>
      <label className="field"><span>Name</span><div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><input className="input" value={name} onChange={e => setName(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))} placeholder="yourname" autoCapitalize="off" spellCheck={false} autoFocus /><b style={{ color: 'var(--text-3)' }}>.testnet</b></div>
        <span className="hint">{!name ? '3–31 letters, numbers or hyphens.' : taken === null ? 'Checking…' : taken ? <span style={{ color: 'var(--red)' }}>Taken. Try another.</span> : <span style={{ color: 'var(--mint)' }}>Available</span>}</span></label>
      <button className="btn btn-primary btn-lg btn-block" disabled={taken !== false} onClick={() => setStep(1)}>Continue <ArrowRight size={18} /></button>
    </>}
    {step === 1 && <>
      <div><h1>Your 12 words.</h1><p className="lede" style={{ fontSize: 15.5, marginTop: 6 }}>They are your wallet on every chain. Write them down, in order.</p></div>
      <Phrase words={words} hidden={hidden} onReveal={() => setHidden(false)} />
      <label className="check"><input type="checkbox" checked={saved} onChange={e => setSaved(e.target.checked)} disabled={hidden} />I wrote them down somewhere safe.</label>
      <button className="btn btn-primary btn-lg btn-block" disabled={!saved} onClick={() => setStep(2)}>Continue <ArrowRight size={18} /></button>
    </>}
    {step === 2 && derived && <>
      <div><h1>Every chain, ready.</h1><p className="lede" style={{ fontSize: 15.5, marginTop: 6 }}>All from your words, made on this device.</p></div>
      <div className="derive-list">
        <div className="derive-row" style={{ borderColor: 'rgba(224,64,200,.35)' }}><span className="lock-ico pq" style={{ width: 26, height: 26, borderRadius: 8 }}><Atom size={15} /></span><b>Quantum-safe key</b><span className="mono" style={{ color: 'var(--mint)' }}>ML-DSA-65</span></div>
        {derived.chains.map((c, i) => <div key={c.id} className="derive-row" style={{ animationDelay: `${(i + 1) * 70}ms` }}><ChainLogo id={c.id} size="sm" /><b>{c.name}</b><span className="mono">{c.id === 'near' ? id : shortAddr(c.address, 6)}</span></div>)}
      </div>
      <button className="btn btn-primary btn-lg btn-block" onClick={() => setStep(3)}>Continue <ArrowRight size={18} /></button>
    </>}
    {step === 3 && <>
      <div><h1>Lock it on this device.</h1><p className="lede" style={{ fontSize: 15.5, marginTop: 6 }}>Your words are encrypted with this password.</p></div>
      <label className="field"><span>Password</span><input className="input" type="password" value={pw} onChange={e => setPw(e.target.value)} placeholder="At least 10 characters" autoComplete="new-password" /></label>
      <label className="field"><span>Repeat password</span><input className="input" type="password" value={pw2} onChange={e => setPw2(e.target.value)} autoComplete="new-password" /></label>
      <div className="txplan"><div>One transaction creates {id}</div><div><code>DeployContract</code>Magen wallet (magen-3)</div><div><code>new</code>Lock 1 ed25519 · Lock 2 ML-DSA-65</div><div><code>AddKey</code>ML-DSA fee key (execute only)</div></div>
      {err && <p className="err" role="alert">{err}</p>}
      <button className="btn btn-primary btn-lg btn-block" onClick={create} disabled={!pw || !!busy}>{busy ? <><Spinner />{busy}</> : <>Create wallet <ArrowRight size={18} /></>}</button>
    </>}
  </>;
}

function Restore({ back }: { back: () => void }) {
  const { adopt } = useWallet();
  const [phrase, setPhrase] = useState(''); const [account, setAccount] = useState('');
  const [pw, setPw] = useState(''); const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const go = async () => {
    setErr(''); setBusy(true);
    try {
      const p = phrase.trim().toLowerCase().split(/\s+/).join(' ');
      if (!validMnemonic(p)) throw Error('Those words are not a valid recovery phrase.');
      if (pw.length < 10) throw Error('Use a password of at least 10 characters.');
      const id = account.trim().toLowerCase();
      const mk = magenKeysFromMnemonic(p);
      const s = await view(id).catch(() => { throw Error(`${id} is not a Magen wallet on NEAR testnet.`); });
      const pk = publicKeys(mk.keys);
      if (s.ed !== base64.encode(pk.ed) || s.pq !== base64.encode(pk.pq)) throw Error('These words don’t open that account.');
      await adopt({ wallet: id, keys: mk.keys, relay: { account: id, seed: mk.feeSeed, pq: true }, mnemonic: p }, pw);
      location.hash = '#/app';
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };
  return <>
    <button className="backstep" onClick={back}><ArrowLeft size={16} />Back</button>
    <div><h1>Restore your wallet.</h1><p className="lede" style={{ fontSize: 15.5, marginTop: 6 }}>Your 12 words open every chain again.</p></div>
    <label className="field"><span>Account</span><input className="input" value={account} onChange={e => setAccount(e.target.value)} placeholder="yourname.testnet" autoCapitalize="off" spellCheck={false} /></label>
    <label className="field"><span>12 words</span><textarea className="input mono masked" value={phrase} onChange={e => setPhrase(e.target.value)} placeholder="word word word …" autoCapitalize="off" spellCheck={false} /></label>
    <label className="field"><span>New password for this device</span><input className="input" type="password" value={pw} onChange={e => setPw(e.target.value)} autoComplete="new-password" /></label>
    {err && <p className="err" role="alert">{err}</p>}
    <button className="btn btn-primary btn-lg btn-block" onClick={go} disabled={busy || !phrase || !account || !pw}>{busy ? <Spinner /> : <RotateCcw size={18} />}Restore</button>
  </>;
}

function Upgrade({ preset = '', create = false, back }: { preset?: string; create?: boolean; back: () => void }) {
  const { adopt } = useWallet();
  const [account, setAccount] = useState(preset); const [name, setName] = useState('');
  const [kind, setKind] = useState<'key' | 'phrase'>('key'); const [secret, setSecret] = useState('');
  const [pw, setPw] = useState(''); const [pw2, setPw2] = useState(''); const [agree, setAgree] = useState(false);
  const [check, setCheck] = useState<Awaited<ReturnType<typeof precheckUpgrade>> | null>(null);
  const [busy, setBusy] = useState(''); const [err, setErr] = useState('');
  const [done, setDone] = useState<{ hash: string; account: string } | null>(null);
  const [seed, setSeed] = useState<Uint8Array | null>(null);

  const verify = async () => {
    setErr(''); setCheck(null);
    try {
      const s = kind === 'key' ? seedFromPrivateKey(secret) : seedFromPhrase(secret);
      const id = account.trim().toLowerCase();
      setBusy('Reading the account from NEAR…');
      const wasm = await (await fetch('/wallet.wasm')).arrayBuffer();
      const c = await precheckUpgrade(id, s, wasm.byteLength);
      setSeed(s); setAccount(id); setCheck(c);
    } catch (e: any) { setErr(e.message); } finally { setBusy(''); }
  };
  const go = async () => {
    setErr('');
    try {
      if (pw.length < 10) throw Error('Use a password of at least 10 characters.');
      if (pw !== pw2) throw Error('The two passwords don’t match.');
      let id = account, s = seed, keys = check?.keys.map(k => k.public_key) ?? [];
      if (create) {
        if (!/^[a-z0-9][a-z0-9-]{2,30}$/.test(name)) throw Error('Use 3–31 lowercase letters, numbers or hyphens.');
        id = `${name}.testnet`; s = random();
        setBusy(`Creating ${id} with the NEAR testnet helper…`);
        await createWithHelper(id, edKeyString(s));
        keys = [edKeyString(s)];
      }
      if (!s) throw Error('Check the account first.');
      setBusy('Making your ML-DSA-65 key and sending the upgrade…');
      const wasm = new Uint8Array(await (await fetch('/wallet.wasm')).arrayBuffer());
      const up = await upgradeInPlace(id, s, wasm, keys, undefined, undefined, 'ml-dsa', async v => { const sealed = await sealVault(v, pw); downloadJson(sealed, `magen-${id}-backup.json`); });
      if (!up.result.success) throw Error(friendlyError(up.result.error));
      const vault = { wallet: id, keys: up.keys, relay: up.fee };
      setBusy('Encrypting your backup…');
      const sealed = await adopt(vault, pw);
      // The backup was already saved before approval/broadcast.
      setDone({ hash: up.result.hash, account: id });
    } catch (e: any) { setErr(friendlyError(String(e.message))); } finally { setBusy(''); }
  };

  if (done) return <>
    <div className="result ok"><h3><ShieldCheck size={24} color="var(--green)" />{done.account} now has two locks.</h3>
      <p>Same account, same balance. Your encrypted backup has downloaded; keep it with your password.</p><TxLink hash={done.hash} label="View the upgrade transaction" /></div>
    <a className="btn btn-primary btn-lg btn-block" href="#/app">Open my wallet <ArrowRight size={18} /></a>
  </>;
  const ready = create || check?.ok;
  return <>
    <button className="backstep" onClick={back}><ArrowLeft size={16} />Back</button>
    <div><h1>{create ? 'Start fresh, upgraded.' : 'Upgrade your account in place.'}</h1>
      <p className="lede" style={{ fontSize: 15.5 }}>{create ? 'Pick a name. Magen creates the testnet account, then adds the second lock in one transaction.' : 'Magen signs one transaction with your current key. The key stays your first lock.'}</p></div>
    {create ? <label className="field"><span>Account name</span><div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><input className="input" value={name} onChange={e => setName(e.target.value.toLowerCase())} placeholder="yourname" autoCapitalize="off" spellCheck={false} /><b style={{ color: 'var(--text-3)' }}>.testnet</b></div></label>
      : <>
        <label className="field"><span>Account</span><input className="input" value={account} onChange={e => { setAccount(e.target.value); setCheck(null); }} placeholder="alice.testnet" autoCapitalize="off" spellCheck={false} /></label>
        <div className="segs" role="tablist"><button className={kind === 'key' ? 'on' : ''} onClick={() => { setKind('key'); setCheck(null); }}>Private key</button><button className={kind === 'phrase' ? 'on' : ''} onClick={() => { setKind('phrase'); setCheck(null); }}>Recovery phrase</button></div>
        <label className="field"><span>{kind === 'key' ? 'Full-access private key' : '12 or 24-word recovery phrase'}</span>
          <textarea className="input mono masked" value={secret} onChange={e => { setSecret(e.target.value); setCheck(null); }} placeholder={kind === 'key' ? 'ed25519:…' : 'word word word …'} autoCapitalize="off" spellCheck={false} style={{ minHeight: 76 }} />
          <span className="hint">Stays on this device. Magen never sends it anywhere; it only signs the upgrade.</span></label>
        {!check && <button className="btn btn-dark btn-lg btn-block" onClick={verify} disabled={!account || !secret || !!busy}>{busy ? <><Spinner />{busy}</> : 'Check this account'}</button>}
        {check && !check.ok && <div className="banner banner-red"><ShieldAlert size={18} /><div><strong>Can’t upgrade this account</strong>{check.problems.join(' ')}</div></div>}
      </>}
    {ready && <>
      {!create && check && <div className="banner banner-green"><ShieldCheck size={18} /><div><strong>Ready: {near(check.balance, 2)} NEAR stays put.</strong>About {near(check.storageNeeded, 2)} NEAR is held for contract storage.</div></div>}
      <div className="txplan">
        <div>One transaction, signed by your key</div>
        <div><code>DeployContract</code>Magen wallet contract (167 kB)</div>
        <div><code>new</code>Lock 1 = your key · Lock 2 = new ML-DSA-65 key</div>
        <div><code>DeleteKey</code>Every full-access key</div>
        <div><code>AddKey</code>An ML-DSA-65 key that may only call execute (pays fees)</div>
      </div>
      <label className="field"><span>Backup password</span><input className="input" type="password" value={pw} onChange={e => setPw(e.target.value)} placeholder="At least 10 characters" autoComplete="new-password" /></label>
      <label className="field"><span>Repeat password</span><input className="input" type="password" value={pw2} onChange={e => setPw2(e.target.value)} autoComplete="new-password" /></label>
      <label className="check"><input type="checkbox" checked={agree} onChange={e => setAgree(e.target.checked)} />I understand there’s no recovery service. Losing the backup file and password means losing access.</label>
      <button className="btn btn-primary btn-lg btn-block" onClick={go} disabled={!agree || !pw || !!busy}>{busy ? <><Spinner />{busy}</> : <>{create ? 'Create and upgrade' : 'Upgrade in place'} <ArrowRight size={18} /></>}</button>
    </>}
    {err && <p className="err" role="alert">{err}</p>}
  </>;
}

function Unlock({ back }: { back: () => void }) {
  const { unlock, hasBackup } = useWallet();
  const [pw, setPw] = useState(''); const [file, setFile] = useState<any>(null); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const go = async () => {
    setErr(''); setBusy(true);
    try { await unlock(pw, file ?? undefined); location.hash = '#/app'; } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };
  return <>
    <button className="backstep" onClick={back}><ArrowLeft size={16} />Back</button>
    <div><h1>Welcome back.</h1><p className="lede" style={{ fontSize: 15.5 }}>Your keys are decrypted on this device only.</p></div>
    {<label className="choice" style={{ cursor: 'pointer' }}><span className="ci"><FileUp size={22} /></span><span><b>{file ? 'Backup file chosen' : 'Choose your backup file'}</b><small>magen-…-backup.json</small></span>
      <input type="file" accept="application/json,.json" className="sr" onChange={async e => { const f = e.target.files?.[0]; if (f) { try { setFile(JSON.parse(await f.text())); } catch { setErr('That file is not a Magen backup.'); } } }} /><span /></label>}
    <label className="field"><span>Password</span><input className="input" type="password" value={pw} onChange={e => setPw(e.target.value)} autoComplete="current-password" onKeyDown={e => e.key === 'Enter' && go()} /></label>
    {err && <p className="err" role="alert">{err}</p>}
    <button className="btn btn-primary btn-lg btn-block" onClick={go} disabled={!pw || busy || (!hasBackup && !file)}>{busy ? <Spinner /> : <LockOpen size={18} />}Unlock</button>
  </>;
}
