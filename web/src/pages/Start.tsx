import { useState } from 'react';
import { ArrowLeft, ArrowRight, ShieldCheck, Sparkles, LockOpen, ChevronRight, ShieldAlert, FileUp } from 'lucide-react';
import { base64, keyString, random } from '../../../sdk/index.ts';
import { precheckUpgrade, seedFromPhrase, seedFromPrivateKey, upgradeInPlace, edKeyString } from '../../../sdk/upgrade.ts';
import { createWithHelper } from '../../../sdk/drillflow.ts';
import { useWallet, downloadJson } from '../lib/store.tsx';
import { friendlyError, near } from '../lib/chain.ts';
import { Spinner, TxLink } from '../ui/bits.tsx';

type Mode = 'choose' | 'upgrade' | 'create' | 'unlock';

export function Start({ mode: initial = 'choose', account: preset = '' }: { mode?: Mode; account?: string }) {
  const { hasBackup } = useWallet();
  const [mode, setMode] = useState<Mode>(initial);
  return <div className="start">
    <aside className="start-art">
      <a className="brand" href="#/"><img src="/art/icon.webp" alt="" />magen</a>
      <img src="/art/hero.webp" alt="" style={{ width: '120%', maxWidth: 'none', marginLeft: '-20%' }} />
      <p>Your account keeps its name, balance and history. It gains a second lock that a quantum computer can’t pick, and NEAR checks both on every payment.</p>
    </aside>
    <main className="start-main"><div className="start-box rise">
      <a className="brand only-m" href="#/" style={{ color: 'var(--text)' }}><img src="/art/icon.webp" alt="" style={{ width: 28, height: 28, borderRadius: 8 }} />magen</a>
      {mode === 'choose' && <>
        <div><h1>Add the second lock.</h1><p className="lede" style={{ fontSize: 15.5 }}>NEAR testnet preview. Your keys are made and kept on this device.</p></div>
        <div className="choices">
          <button className="choice primary" onClick={() => setMode('upgrade')}><span className="ci"><ShieldCheck size={22} /></span><span><b>Upgrade an account I have</b><small>Same name and balance. One transaction.</small></span><ChevronRight size={18} /></button>
          <button className="choice" onClick={() => setMode('create')}><span className="ci"><Sparkles size={22} /></span><span><b>Start with a new testnet account</b><small>We create it with 10 test NEAR, then upgrade it.</small></span><ChevronRight size={18} /></button>
          <button className="choice" onClick={() => setMode('unlock')}><span className="ci"><LockOpen size={22} /></span><span><b>{hasBackup ? 'Unlock my wallet' : 'Restore from a backup file'}</b><small>{hasBackup ? 'Your encrypted backup is on this device.' : 'Use the encrypted file Magen gave you.'}</small></span><ChevronRight size={18} /></button>
        </div>
        <a className="link" href="#/app">Just look around the demo wallet</a>
      </>}
      {mode === 'upgrade' && <Upgrade preset={preset} back={() => setMode('choose')} />}
      {mode === 'create' && <Upgrade create back={() => setMode('choose')} />}
      {mode === 'unlock' && <Unlock back={() => setMode('choose')} />}
    </div></main>
  </div>;
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
      const up = await upgradeInPlace(id, s, wasm, keys);
      if (!up.result.success) throw Error(friendlyError(up.result.error));
      const vault = { wallet: id, keys: up.keys, relay: { account: id, seed: base64.encode(s) } };
      setBusy('Encrypting your backup…');
      const sealed = await adopt(vault, pw);
      downloadJson(sealed, `magen-${id}-backup.json`);
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
          <textarea className="input mono" value={secret} onChange={e => { setSecret(e.target.value); setCheck(null); }} placeholder={kind === 'key' ? 'ed25519:…' : 'word word word …'} autoCapitalize="off" spellCheck={false} style={{ minHeight: 76 }} />
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
        <div><code>AddKey</code>Your key again, allowed only to call execute</div>
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
    {(!hasBackup || file) && <label className="choice" style={{ cursor: 'pointer' }}><span className="ci"><FileUp size={22} /></span><span><b>{file ? 'Backup file chosen' : 'Choose your backup file'}</b><small>magen-…-backup.json</small></span>
      <input type="file" accept="application/json,.json" className="sr" onChange={async e => { const f = e.target.files?.[0]; if (f) { try { setFile(JSON.parse(await f.text())); } catch { setErr('That file is not a Magen backup.'); } } }} /><span /></label>}
    <label className="field"><span>Password</span><input className="input" type="password" value={pw} onChange={e => setPw(e.target.value)} autoComplete="current-password" onKeyDown={e => e.key === 'Enter' && go()} /></label>
    {err && <p className="err" role="alert">{err}</p>}
    <button className="btn btn-primary btn-lg btn-block" onClick={go} disabled={!pw || busy || (!hasBackup && !file)}>{busy ? <Spinner /> : <LockOpen size={18} />}Unlock</button>
  </>;
}
