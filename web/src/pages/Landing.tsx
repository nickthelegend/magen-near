import { useEffect, useState } from 'react';
import { ArrowRight, Search, ShieldCheck, ShieldAlert, Check, X, FileCode2, KeyRound, Trash2, Lock, ExternalLink, Chrome, Smartphone, Globe, Download } from 'lucide-react';
import { scanAccount, type Scan } from '../../../sdk/scan.ts';
import { networkStatus, short, txUrl } from '../lib/chain.ts';
import { Gauge, Spinner, useAsync } from '../ui/bits.tsx';

const SAMPLES = [
  { id: 'root.near', note: 'mainnet' },
  { id: 'aurora', note: 'mainnet' },
  { id: 'magen.drill-mwf4jsnn.testnet', note: 'Magen' },
];

export function Landing({ initial }: { initial?: string }) {
  const [q, setQ] = useState(initial ?? '');
  const [scan, setScan] = useState<Scan | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const net = useAsync(networkStatus, []);
  const drill = useAsync(() => fetch('/drill-live.json').then(r => r.json()), []);
  const run = async (id: string) => {
    setQ(id); setErr(''); setBusy(true); setScan(null);
    try { const s = await scanAccount(id); setScan(s); history.replaceState(null, '', `#/scan/${s.account}`); }
    catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };
  useEffect(() => { if (initial) run(initial); }, []);
  const d = drill.data;
  const tx = (name: string) => d?.transactions?.find((t: any) => t.name === name);
  return <div className="landing">
    <nav className="nav"><div className="nav-in">
      <a className="brand" href="#/"><img src="/art/icon.webp" alt="" />magen</a>
      <div className="nav-links"><a href="#get">Get Magen</a><a href="#drill">The drill</a><a href="#how">How it works</a><a href="#limits">Security</a><a href="#faq">FAQ</a></div>
      <div className="nav-right"><a className="btn btn-ghost-dark btn-sm hide-sm" href="/downloads/magen-extension.zip">Get the extension</a><a className="btn btn-primary btn-sm" href="#/app">Open wallet</a></div>
    </div></nav>

    <header className="hero"><div className="hero-in">
      <div className="rise">
        <h1>Keep your NEAR account. Add a second lock <em>a quantum computer can’t pick.</em></h1>
        <p className="hero-lede">Magen upgrades the account you already have, in place. After that, every payment needs your usual key and a post-quantum ML-DSA-65 key, and NEAR checks both.</p>
        <div className="scanbox">
          <form className="scan-form" onSubmit={e => { e.preventDefault(); if (q.trim()) run(q); }}>
            <input aria-label="NEAR account to scan" placeholder="Paste any NEAR account, like alice.near" value={q} onChange={e => setQ(e.target.value)} autoCapitalize="off" autoCorrect="off" spellCheck={false} />
            <button className="btn btn-primary" disabled={busy || !q.trim()}>{busy ? <Spinner /> : <Search size={17} />} Check my account</button>
          </form>
          <div className="scan-try">Try {SAMPLES.map(s => <button key={s.id} type="button" onClick={() => run(s.id)}>{short(s.id, 14, 8)} <span style={{ opacity: .6 }}>· {s.note}</span></button>)}</div>
        </div>
        <div className="hero-meta">
          <span>NEAR mainnet protocol <b>{net.data?.mainnet ?? '…'}</b></span>
          <span>testnet <b>{net.data?.testnet ?? '…'}</b></span>
          <span>ML-DSA-65 keys native since <b>July 2026</b></span>
        </div>
      </div>
      <div className="hero-art"><img src="/art/hero.webp" alt="A wallet held shut by an ordinary padlock and a second lock made of a blue lattice" /></div>
    </div></header>

    {(scan || err || busy) && <section className="scan-result rise" aria-live="polite">
      {err ? <div className="card card-pad"><div className="banner banner-red"><ShieldAlert size={18} /><div><strong>Couldn’t scan that account</strong>{err}</div></div></div>
        : busy ? <div className="card scan-card"><div className="scan-score"><div className="skel" style={{ width: 160, height: 160, borderRadius: '50%', opacity: .15 }} /></div><div className="scan-body"><div className="skel" style={{ height: 28, width: '70%' }} /><div className="skel" style={{ height: 160 }} /></div></div>
        : scan && <ScanCard s={scan} />}
    </section>}

    <section className="section" id="get">
      <p className="eyebrow">Get Magen</p>
      <h2 className="h2">In your browser and on your phone.</h2>
      <p className="lede">The same two locks everywhere. Keys are made on your device and never leave it.</p>
      <div className="get-grid">
        <div className="get-card dark">
          <span className="get-ico"><Chrome size={22} /></span>
          <h3>Chrome extension</h3>
          <p>Unlock, send, receive and flip the Q-Day switch from the toolbar. dApps connect through <code>window.magen</code>, and every request shows “Signed twice: classical + quantum-safe”.</p>
          <div className="get-actions"><a className="btn btn-primary" href="/downloads/magen-extension.zip" download><Download size={17} />Download .zip</a><a className="link" style={{ color: '#8fa8ff' }} href="/dapp/index.html">Try the demo dApp</a></div>
          <small>chrome://extensions → Developer mode → Load unpacked</small>
        </div>
        <div className="get-card">
          <span className="get-ico"><Smartphone size={22} /></span>
          <h3>iPhone app</h3>
          <p>Upgrade, send with both signatures, receive by QR and flip the Q-Day switch. Keys live in the iOS keychain; ML-DSA-65 signs on the phone.</p>
          <div className="get-actions"><a className="btn btn-dark" href="/downloads/Magen-NEAR-iOS-Simulator.zip" download><Download size={17} />iOS Simulator build</a></div>
          <small>Unzip, then xcrun simctl install booted Magen.app</small>
        </div>
        <div className="get-card">
          <span className="get-ico"><Globe size={22} /></span>
          <h3>Web wallet</h3>
          <p>The readiness scan, the key-recovery drill and a full wallet in any browser. Nothing to install.</p>
          <div className="get-actions"><a className="btn btn-light" href="#/app">Open the web wallet</a></div>
          <small>NEAR testnet preview</small>
        </div>
      </div>
      <pre className="snippet"><code>{`const { accountId } = await window.magen.connect();
await window.magen.signAndSendTransaction({
  receiverId: 'bob.testnet',
  actions: [{ type: 'Transfer', params: { deposit: '100000000000000000000000' } }],
}); // signed with ed25519 + ML-DSA-65, both checked on chain`}</code></pre>
    </section>

    <section className="section section-tight" id="drill">
      <p className="eyebrow">Steal the key, still get nothing</p>
      <h2 className="h2">Same stolen key. One account emptied. One didn’t move.</h2>
      <p className="lede">We ran a key-recovery drill on NEAR testnet. Both accounts started with one classical key, weakened on purpose so a laptop can play the quantum computer. The attacker read each public key from the chain and worked out the private key.</p>
      <div className="duel">
        <div className="duel-card">
          <h3><ShieldAlert size={16} /> Plain NEAR account</h3>
          <div className="duel-num"><s>{d?.balances?.before?.plain ?? '4.00'}</s><small>NEAR</small></div>
          <div className="duel-num" style={{ fontSize: 30, marginTop: 10, color: 'var(--red)' }}>0.00 <small>NEAR · drained</small></div>
          <div className="duel-foot">
            <span className="txline">The recovered key moved everything to the attacker.</span>
            {tx('attacker drains plain account') && <span className="txline"><a href={txUrl(tx('attacker drains plain account').hash)} target="_blank" rel="noreferrer">Drain transaction {short(tx('attacker drains plain account').hash)}</a></span>}
          </div>
        </div>
        <div className="duel-card dark">
          <h3><ShieldCheck size={16} /> Magen account</h3>
          <div className="duel-num">{d?.balances?.after?.magen ?? '4.00'}<small>NEAR</small></div>
          <div style={{ marginTop: 14 }}><span className="pill pill-ink"><span className="dot" style={{ color: '#8fa8ff' }} />Refused on chain: quantum half missing</span></div>
          <img className="art" src="/art/crowbar.webp" alt="" />
          <div className="duel-foot">
            <span className="txline">The same key signed a transfer. The contract asked for the second signature.</span>
            {tx('attacker tries the Magen account') && <span className="txline"><a href={txUrl(tx('attacker tries the Magen account').hash)} target="_blank" rel="noreferrer">Refused transaction {short(tx('attacker tries the Magen account').hash)}</a></span>}
          </div>
        </div>
      </div>
      <div style={{ marginTop: 22, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <a className="btn btn-dark" href="#/app/drill">Run the drill yourself <ArrowRight size={17} /></a>
        <span className="hint">Simulated key compromise on testnet. Real ed25519 keys come from 2<sup>256</sup> possibilities, not 2<sup>18</sup>.</span>
      </div>
    </section>

    <section className="section section-tight" id="how">
      <p className="eyebrow">How the upgrade works</p>
      <h2 className="h2">One transaction. Same name, same balance, a second lock.</h2>
      <p className="lede">On NEAR an account is not its key, so the lock can change while everything else stays. Magen sends one atomic transaction from your own key.</p>
      <div className="txviz">
        <div className="txviz-art"><img src="/art/classical-vs-lattice.webp" alt="An ordinary padlock next to a lattice padlock" /></div>
        <div className="actions-list">
          <div className="act"><span className="act-ico"><FileCode2 size={20} /></span><div><h4>Deploy the wallet contract <code>DeployContract</code></h4><p>Your account starts running Magen’s open-source contract. Funds stay where they are.</p></div></div>
          <div className="act"><span className="act-ico"><Lock size={20} /></span><div><h4>Set both locks <code>new(ed25519, ML-DSA-65)</code></h4><p>Your current key becomes the first lock. A new ML-DSA-65 key, made in your browser, becomes the second.</p></div></div>
          <div className="act"><span className="act-ico"><Trash2 size={20} /></span><div><h4>Take away the master key <code>DeleteKey</code></h4><p>No key can move funds by itself any more. Not yours, not a thief’s.</p></div></div>
          <div className="act"><span className="act-ico"><KeyRound size={20} /></span><div><h4>Add a post-quantum doorbell <code>AddKey · ML-DSA-65 · execute only</code></h4><p>A new ML-DSA-65 key that can only ask the contract to act and pay its fee. NEAR now lists zero classical keys for your account.</p></div></div>
        </div>
      </div>
      <div className="stats">
        <div className="stat"><b>2</b><span>signatures checked on chain for every payment</span></div>
        <div className="stat"><b>3,309</b><span>bytes in each ML-DSA-65 signature, verified by NEAR itself</span></div>
        <div className="stat"><b>{d ? '1' : '…'}</b><span>transaction to upgrade, no funds moved</span></div>
        <div className="stat"><b>74</b><span>automated tests, 46 of them against a real local NEAR node</span></div>
      </div>
    </section>

    <section className="section section-tight">
      <div className="features">
        <div className="feature"><div><h3>The second lock</h3><p>ML-DSA-65 is the NIST post-quantum signature NEAR added in 2026. Magen requires it next to ed25519, the hybrid setup European security agencies recommend during the transition.</p></div><img src="/art/lattice-lock.webp" alt="" /></div>
        <div className="feature"><div><h3>Your account, not a new one</h3><p>Other quantum-safe wallets make you move into a fresh vault. Magen keeps your name, balance, staking and history.</p></div><img src="/art/shield-wallet.webp" alt="" /></div>
        <div className="feature"><div><h3>The Q-Day switch</h3><p>When classical keys stop being safe, one tap adds a native ML-DSA-65 access key. NEAR then shows it in the account’s key list.</p></div><img src="/art/classical-vs-lattice.webp" alt="" /></div>
        <div className="feature"><div><h3>Refused, on the record</h3><p>Forged halves, replays, expired or edited payments: the contract refuses them on chain, with a reason anyone can read.</p></div><img src="/art/crowbar.webp" alt="" /></div>
      </div>
    </section>

    <section className="dark-band" id="limits"><div className="section">
      <p className="eyebrow" style={{ color: '#8fa8ff' }}>Security, plainly</p>
      <h2 className="h2">What Magen protects, and what it doesn’t.</h2>
      <div className="limits">
        <div className="limit-col"><h3><Check size={18} /> Protects</h3><ul>
          <li>Your NEAR balance against someone who works out your classical key from public chain data.</li>
          <li>Against a broken signature scheme: a forger needs ed25519 and ML-DSA-65 at once.</li>
          <li>Against replayed, expired or edited payments. Each one is signed with its own nonce and expiry.</li>
        </ul></div>
        <div className="limit-col no"><h3><X size={18} /> Doesn’t protect</h3><ul>
          <li>A stolen device or password. Both keys live in your browser, encrypted with your password.</li>
          <li>Chain Signatures and validator keys. They are still classical on NEAR today.</li>
          <li>Real money yet. Magen runs on NEAR testnet and has not been audited.</li>
        </ul></div>
      </div>
    </div></section>

    <section className="section" id="faq">
      <p className="eyebrow">Questions</p>
      <h2 className="h2">Fair questions.</h2>
      <div className="faq">
        <details><summary>Is there a quantum computer that can do this today?</summary><p>No. The largest public break so far is a 15-bit elliptic-curve key (April 2026). Google estimates a 256-bit curve needs under 500,000 physical qubits. Magen is preparation: your keys are public on NEAR today, so an attacker can collect them now and use them later.</p></details>
        <details><summary>Why are my keys public?</summary><p>NEAR shows every account’s access keys to anyone through view_access_key_list. A 64-character implicit account is its public key. That is fine for classical cryptography and exactly what a quantum attacker needs.</p></details>
        <details><summary>Why two signatures and not only the post-quantum one?</summary><p>ML-DSA is new. If an implementation bug appears, ed25519 still holds. If ed25519 falls, ML-DSA still holds. NEAR’s native keys are one scheme each, so Magen enforces the pair in a contract.</p></details>
        <details><summary>What does the Q-Day switch change?</summary><p>It adds your ML-DSA-65 key to the account as a native NEAR full-access key. After that, that post-quantum key alone can act at the protocol level, which is what you want once classical keys can be forged.</p></details>
        <details><summary>Is the drill a real attack?</summary><p>It is a real attack on deliberately weak keys. The drill’s classical keys come from only 262,144 possibilities, so a laptop finds them from the public key in seconds. The drain and the refusal are real testnet transactions.</p></details>
        <details><summary>Where is the code?</summary><p>The contract, signing SDK, tests and this app are MIT-licensed. Every testnet transaction is listed in the repository’s deployments folder.</p></details>
      </div>
    </section>

    <section className="section section-tight">
      <div className="cta-band">
        <div><h2>Check your account, then add the second lock.</h2><p style={{ color: 'var(--on-ink-2)', marginTop: 12, lineHeight: 1.6 }}>Testnet preview. Takes one transaction.</p>
          <div style={{ display: 'flex', gap: 10, marginTop: 24, flexWrap: 'wrap' }}><a className="btn btn-primary btn-lg" href="#/start">Upgrade my account</a><a className="btn btn-ghost-dark btn-lg" href="#/app">See the demo wallet</a></div></div>
        <img src="/art/shield-wallet.webp" alt="" />
      </div>
    </section>

    <footer className="footer"><div className="footer-in">
      <span>Magen · מגן means shield · NEAR testnet preview, not audited</span>
      <span style={{ display: 'flex', gap: 18 }}><a href="/magen-source.zip">Source <ExternalLink size={12} /></a><a href="#/app/security">Security</a><a href="#/app/drill">Drill</a></span>
    </div></footer>
  </div>;
}

function ScanCard({ s }: { s: Scan }) {
  const tone = s.level === 'exposed' ? 'pill-red' : s.level === 'native' ? 'pill-blue' : s.level === 'protected' ? 'pill-blue' : 'pill-amber';
  const label = s.level === 'exposed' ? 'Exposed' : s.level === 'native' ? 'Post-quantum native' : s.level === 'protected' ? 'Two locks' : 'Limited';
  return <div className="card scan-card">
    <div className="scan-score">
      <span className={`pill ${tone}`} style={{ alignSelf: 'flex-start' }}>{label}</span>
      <Gauge score={s.score} />
      <div className="acct"><b style={{ color: '#fff', fontWeight: 600 }}>{s.account}</b><br />NEAR {s.network}{s.implicit ? ' · implicit account' : ''}</div>
    </div>
    <div className="scan-body">
      <h3>{s.headline}</h3>
      {s.implicit && <div className="banner banner-gray"><KeyRound size={18} /><div>This account’s name is its public key, so it has been public since the account was made.</div></div>}
      <div className="checks">
        {s.checks.map(c => <div className="check-row" key={c.label}>
          {c.ok ? <Check size={20} className="ico-ok" /> : <X size={20} className="ico-bad" />}
          <div><b>{c.label}</b><p>{c.detail}</p></div><span className="pts">{c.ok ? `+${c.points}` : `0 / ${c.points}`}</span>
        </div>)}
      </div>
      <div className="keys-mini">{s.keys.slice(0, 4).map(k => <span className="keychip" key={k.publicKey}>
        <span className={`pill ${k.scheme === 'ml-dsa-65' ? 'pill-blue' : k.fullAccess ? 'pill-red' : 'pill-gray'}`}>{k.scheme}</span>
        <span className="mono">{short(k.publicKey, 16, 6)}</span><span className="card-sub">{k.fullAccess ? 'full access' : `calls ${k.methods?.join(', ') || 'any method'}`}</span>
      </span>)}{s.keys.length > 4 && <span className="keychip">+{s.keys.length - 4} more</span>}</div>
      <div className="scan-actions">
        {s.level === 'exposed' && s.network === 'testnet' && <a className="btn btn-primary" href={`#/start/upgrade/${s.account}`}>Upgrade this account in place <ArrowRight size={17} /></a>}
        {s.level === 'exposed' && s.network === 'mainnet' && <><a className="btn btn-primary" href="#/start">Try the upgrade on testnet <ArrowRight size={17} /></a><span className="hint">Magen is a testnet preview. Mainnet upgrades come after an audit.</span></>}
        {s.isMagen && <a className="btn btn-dark" href="#/app">Open this wallet</a>}
        <a className="link" href={`${s.network === 'mainnet' ? 'https://near.rocks' : 'https://testnet.near.rocks'}/account/${s.account}`} target="_blank" rel="noreferrer">See keys in the explorer <ExternalLink size={13} /></a>
      </div>
    </div>
  </div>;
}
