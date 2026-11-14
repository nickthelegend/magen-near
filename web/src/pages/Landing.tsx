import { useEffect, useState } from 'react';
import { ArrowRight, Check, Chrome, Smartphone, Globe, Download, KeyRound, Atom, ArrowUpRight, ExternalLink, Repeat, Send, Bitcoin, ShieldCheck, Sparkles } from 'lucide-react';
import { Brand, Mark } from '../ui/Logo.tsx';
import { ChainLogo } from '../ui/chain.tsx';
import { rpc } from '../../../sdk/index.ts';
import { RPCS } from '../../../sdk/scan.ts';
import { demoWallet, LOGO, fmt } from '../lib/multi.ts';
import { readAccount } from '../lib/chain.ts';
import { ftBalance } from '../../../sdk/swap.ts';
import { splBalance } from '../../../sdk/omni.ts';

const CHAINS: [string, string, string?][] = [
  ['near', 'NEAR', 'base'], ['bitcoin', 'Bitcoin', 'in'], ['zcash', 'Zcash', 'in'], ['solana', 'Solana', 'out'], ['ethereum', 'Ethereum', 'out'], ['base', 'Base', 'out'],
  ['arbitrum', 'Arbitrum', 'out'], ['avalanche', 'Avalanche', 'out'], ['cosmos', 'Cosmos'], ['litecoin', 'Litecoin'], ['dogecoin', 'Dogecoin'],
];
const TAG: Record<string, string> = { base: 'Quantum-safe base', in: 'Bridge in · live', out: 'Bridge out · live' };

const EXPLORER_TX = (h: string) => `https://testnet.nearblocks.io/txns/${h}`;
type Live = { height?: number; protocol?: number; near?: bigint; usdt?: bigint; sol?: bigint };
function useLive(account: string | null) {
  const [l, set] = useState<Live>({});
  useEffect(() => {
    if (!account) return;
    let on = true;
    const load = async () => {
      const [st, acc, usdt, sol] = await Promise.allSettled([rpc('status', [], RPCS.testnet), readAccount(account), ftBalance('usdt.itachicara.testnet', account), demoWallet().then(d => splBalance(d.chains.find((c: any) => c.id === 'solana').address))]);
      if (!on) return;
      set({
        height: st.status === 'fulfilled' ? st.value.sync_info.latest_block_height : undefined, protocol: st.status === 'fulfilled' ? st.value.protocol_version : undefined,
        near: acc.status === 'fulfilled' && acc.value ? acc.value.amount : undefined, usdt: usdt.status === 'fulfilled' ? usdt.value : undefined, sol: sol.status === 'fulfilled' ? sol.value.amount : undefined,
      });
    };
    load(); const t = setInterval(load, 6000); return () => { on = false; clearInterval(t); };
  }, [account]);
  return l;
}
const y24 = (v?: bigint) => v === undefined ? '…' : fmt(Number(v / 10n ** 18n) / 1e6, 4);
const y9 = (v?: bigint) => v === undefined ? '…' : fmt(Number(v) / 1e9, 4);

export function Landing() {
  const [demo, setDemo] = useState<any>(null);
  const [proof, setProof] = useState<any[]>([]);
  useEffect(() => { demoWallet().then(setDemo).catch(() => {}); fetch('/v2-live.json').then(r => r.json()).then(d => setProof(d.runs ?? [])).catch(() => {}); }, []);
  const live = useLive(demo?.account ?? null);
  const swap = proof.find(p => p.what?.startsWith('swap') && p.success);
  const out = proof.find(p => p.what?.startsWith('bridge out') && p.success);
  const create = proof.find(p => p.what?.startsWith('create') && p.success);

  return <div className="landing">
    <nav className="nav"><div className="nav-in">
      <Brand />
      <div className="nav-links"><a href="#chains">Chains</a><a href="#how">How it works</a><a href="#compare">Compare</a><a href="#qday">Q-Day</a><a href="#download">Download</a></div>
      <div className="nav-right"><a className="btn btn-ghost-dark btn-sm hide-sm" href="#download"><Download size={15} />Download</a><a className="btn btn-primary btn-sm" href="#/app">Open wallet</a></div>
    </div></nav>

    <header className="hero6"><div className="hero6-grid">
      <div className="h6-portrait rise">
        <img src="/v4/hero-landing.jpg" alt="A man in profile among floating matte coins" width={1536} height={1024} />
        <div className="h6-copy">
          <span className="hero-chip"><b>Live</b>ML-DSA-65 signatures, checked on NEAR</span>
          <h1>One seed.<br />Every chain.<br /><em>Quantum-safe.</em></h1>
          <p className="hero-lede">Bitcoin, Zcash, Ethereum and Solana from 12 words, kept on NEAR under a quantum-safe signature.</p>
          <div className="hero-cta">
            <a className="btn btn-primary btn-lg" href="#/start/create">Create a wallet <ArrowRight size={18} /></a>
            <a className="btn btn-onink btn-lg" href="#download"><Download size={18} />Get the app</a>
          </div>
        </div>
      </div>
      <div className="h6-stage rise" style={{ animationDelay: '.1s' }}>
        <PhonePreview demo={demo} live={live} />
      </div>
      <div className="h6-card magenta rise" style={{ animationDelay: '.15s' }}>
        <span className="h6-ico"><ShieldCheck size={20} /></span>
        <div><small>Every move</small><b>Signed twice</b><span className="h6-sub">ed25519 + ML-DSA-65, both checked on NEAR</span></div>
        <a className="btn btn-ink btn-block" href="#how">How it works</a>
      </div>
      <div className="h6-card ink rise" style={{ animationDelay: '.2s' }}>
        <span className="h6-ico"><ChainLogo id="bitcoin" size="sm" /></span>
        <div><small>Bridge in</small><b>BTC → nBTC</b><span className="h6-sub">{out ? `Bridged out to Solana in ${out.destination?.seconds_after_init ?? '~15'} s, live` : 'Your own Bitcoin deposit address'}</span></div>
        <a className="btn btn-primary btn-block" href="#/start/create">Start now</a>
      </div>
    </div></header>

    <section className="section section-tight" id="chains">
      <div className="sec-head"><span className="eyebrow">Twelve words, eleven chains</span><h2 className="h2">Every address you need. One phrase to back it up.</h2></div>
      <div className="chain-marquee">{CHAINS.map(([id, name, t]) => <span key={id} className={`chain-chip ${t ? 'live' : ''}`}><ChainLogo id={id} />{name}{t && <small>{TAG[t]}</small>}</span>)}</div>
    </section>

    <section className="section" id="how"><div className="wrap">
      <div className="sec-head"><span className="eyebrow">How it works</span><h2 className="h2">Quantum-safe, without learning anything new.</h2></div>
      <div className="steps3">
        <div className="step-card"><span className="n">01</span><h3>Write down 12 words</h3><p>They open Bitcoin, Ethereum, Solana and more. The same words also make your quantum-safe key.</p>
          <div className="art"><div className="words">{['ocean', 'lattice', 'harbor', 'violet', 'anchor', 'meadow'].map((w, i) => <span key={i}><i>{i + 1}</i><span className="blurred">{w}</span></span>)}</div><div className="sigline" style={{ color: 'var(--mint)' }}><Atom size={15} /><b>ML-DSA-65 key</b><small>same seed</small></div></div></div>
        <div className="step-card"><span className="n">02</span><h3>Bring coins to NEAR</h3><p>Send BTC or ZEC to your personal bridge address. They arrive on NEAR as nBTC or nZEC.</p>
          <div className="art">{[['bitcoin', 'Bitcoin', 'nBTC'], ['zcash', 'Zcash', 'nZEC'], ['solana', 'Solana', 'wNEAR out']].map(([id, n, t]) => <div key={id} className="sigline"><ChainLogo id={id} size="sm" /><b>{n}</b><small>{t}</small></div>)}</div></div>
        <div className="step-card"><span className="n">03</span><h3>Every move, signed twice</h3><p>Send, swap or bridge out: NEAR checks your classical and your quantum-safe signature before anything moves.</p>
          <div className="art sigpair"><div className="sigline"><KeyRound size={15} /><b>ed25519</b><Check size={15} className="ico-ok" style={{ marginLeft: 'auto' }} /></div><div className="sigline"><Atom size={15} color="var(--mint)" /><b>ML-DSA-65</b><Check size={15} className="ico-ok" style={{ marginLeft: 'auto' }} /></div><div className="sigline"><ShieldCheck size={15} /><b>Both verified on NEAR</b><small>or nothing moves</small></div></div></div>
      </div>
    </div></section>

    <section className="section" id="proof"><div className="wrap">
      <div className="sec-head"><span className="eyebrow"><span className="live-dot" />Live on NEAR testnet</span><h2 className="h2">Real transactions, not promises.</h2></div>
      <div className="proof-grid">
        <div className="card"><div className="proof-list">
          {create && <ProofRow icon={<Sparkles size={18} />} title="Wallet created from 12 words" sub="Deploy + both locks + ML-DSA fee key, one tx" hash={create.hash} />}
          {swap && <ProofRow icon={<Repeat size={18} />} title={`Swap 1 NEAR → ${y24(BigInt(swap.received))} USDT`} sub="4 calls, one dual-signed approval, Ref Finance" hash={swap.hash} />}
          {out && <ProofRow icon={<Send size={18} />} title="Bridge 0.5 NEAR to Solana devnet" sub={`Omni Bridge · finalised on Solana in ${out.destination?.seconds_after_init ?? '~15'} s`} hash={out.hash} />}
          <ProofRow icon={<Bitcoin size={18} />} title="Bitcoin and Zcash deposit addresses" sub="Derived on chain by the Omni connectors" href={demo ? `https://testnet.nearblocks.io/address/btc-connector.n-bridge.testnet` : undefined} />
        </div></div>
        <div className="stats">
          <div className="stat"><b className="num">{live.height?.toLocaleString() ?? '…'}</b><span>NEAR testnet block, live</span></div>
          <div className="stat"><b>{live.protocol ?? '…'}</b><span>Protocol version (ML-DSA since 87)</span></div>
          <div className="stat"><b className="num">{y24(live.usdt)}</b><span>USDT the demo wallet swapped for</span></div>
          <div className="stat"><b className="num">{y9(live.sol)}</b><span>wNEAR it bridged to its Solana address</span></div>
        </div>
      </div>
    </div></section>

    <section className="section" id="compare"><div className="wrap">
      <div className="sec-head"><span className="eyebrow">Compare</span><h2 className="h2">Multichain wallets aren’t quantum-safe. Quantum-safe wallets aren’t multichain.</h2></div>
      <Compare />
    </div></section>

    <section className="section" id="qday"><div className="wrap">
      <div className="sec-head"><span className="eyebrow">Q-Day, simply</span><h2 className="h2">The day a quantum computer can forge today’s signatures.</h2><p className="lede">Magen is ready for both sides of it.</p></div>
      <div className="qday-band">
        <div className="era"><span className="pill">Today</span><h3>Two locks on every move</h3><p>Your classical key and your ML-DSA-65 key both sign. Stealing one gets a thief nothing.</p>
          <div className="sigpair"><div className="sigline"><KeyRound size={15} /><b>ed25519</b><small>required</small></div><div className="sigline" style={{ color: 'var(--mint)' }}><Atom size={15} /><b>ML-DSA-65</b><small>required</small></div></div></div>
        <div className="era after"><span className="pill pill-green">Q-Day switch</span><h3>One tap, quantum-only</h3><p>Flip the switch and NEAR itself lists your ML-DSA-65 key. Then remove the classical key for good.</p>
          <div className="sigpair"><div className="sigline" style={{ opacity: .45 }}><KeyRound size={15} /><b><s>ed25519</s></b><small>removed</small></div><div className="sigline" style={{ color: 'var(--mint)' }}><Atom size={15} /><b>ML-DSA-65</b><small>native NEAR key</small></div></div></div>
      </div>
    </div></section>

    <section className="section" id="limits"><div className="wrap">
      <div className="sec-head"><span className="eyebrow">Honest limits</span><h2 className="h2">What Magen protects, and what it can’t.</h2></div>
      <div className="limits">
        <div className="limit-col"><h3>Protected</h3><ul>
          <li>Everything on your NEAR account: nothing moves without both signatures, checked on chain.</li>
          <li>The control path: swaps, bridges and sends out of NEAR all start with that dual check.</li>
          <li>Coins you bridge in (nBTC, nZEC) sit under that lock.</li>
        </ul></div>
        <div className="limit-col no"><h3>Not yet</h3><ul>
          <li>Bitcoin, Ethereum and Solana keys are classical on their own chains. Magen can’t change that.</li>
          <li>The bridges’ MPC signers are classical too. Bridging ZEC in removes its shielding.</li>
          <li>Testnet only, no audit. Both keys live on your device.</li>
        </ul></div>
      </div>
    </div></section>

    <section className="section" id="download"><div className="wrap">
      <div className="sec-head"><span className="eyebrow">Download</span><h2 className="h2">Phone, browser and web. One phrase on all three.</h2></div>
      <div className="get-grid">
        <div className="get-card dark"><span className="get-ico"><Smartphone size={22} /></span><h3>iPhone app</h3><p>Create a wallet, scan, send and swap. Keys stay in the iOS keychain.</p><div className="get-actions"><a className="btn btn-primary btn-sm" href="/downloads/Magen-NEAR-iOS-Simulator.zip"><Download size={15} />iOS Simulator build</a></div><small>Release build for Apple-silicon simulators</small></div>
        <div className="get-card"><span className="get-ico"><Chrome size={22} /></span><h3>Chrome extension</h3><p>A popup wallet that dApps reach through <span className="mono">window.magen</span>.</p><div className="get-actions"><a className="btn btn-light btn-sm" href="/downloads/magen-extension.zip"><Download size={15} />Extension .zip</a></div><small>chrome://extensions → Load unpacked</small></div>
        <div className="get-card"><span className="get-ico"><Globe size={22} /></span><h3>Web wallet</h3><p>Everything, in the browser. Look around the live demo wallet first.</p><div className="get-actions"><a className="btn btn-light btn-sm" href="#/app">Open the web wallet <ArrowUpRight size={15} /></a></div><small>NEAR testnet</small></div>
      </div>
    </div></section>

    <section className="section" id="faq"><div className="wrap">
      <div className="sec-head"><span className="eyebrow">FAQ</span><h2 className="h2">Questions</h2></div>
      <div className="faq">
        <details><summary>What is a quantum-safe key?</summary><p>ML-DSA-65 is a signature scheme NIST standardised in 2024. Today’s keys (ed25519, secp256k1) can be broken by a large quantum computer; ML-DSA is built to resist one. NEAR checks ML-DSA signatures natively since protocol 87.</p></details>
        <details><summary>Why sign twice instead of switching?</summary><p>Hybrid is what European security agencies recommend during the transition: if either scheme has a flaw, the other still holds. When you’re ready, the Q-Day switch makes the ML-DSA key a native NEAR key.</p></details>
        <details><summary>Does this make my Bitcoin quantum-safe?</summary><p>No. Bitcoin’s own keys stay classical. What Magen does is give your coins a quantum-safe home: bridge them to NEAR, where every move needs your ML-DSA signature.</p></details>
        <details><summary>What do the 12 words back up?</summary><p>Every chain address (standard BIP-39/44 paths), your NEAR key and your ML-DSA-65 key, derived from the same seed with HKDF-SHA-256 and the label <span className="mono">magen:ml-dsa-65:v1</span>.</p></details>
        <details><summary>Is it live?</summary><p>On NEAR testnet, yes: every transaction on this page links to the explorer. Not audited, not for real funds yet.</p></details>
      </div>
    </div></section>

    <section className="section"><div className="cta-band"><Mark size={64} /><h2>Your coins deserve a lock from the future.</h2><a className="btn btn-primary btn-lg" href="#/start/create">Create a wallet <ArrowRight size={18} /></a></div></section>

    <footer className="footer"><div className="footer-in"><Brand /><nav><a href="https://github.com/nickthelegend/magen-near" target="_blank" rel="noreferrer">GitHub</a><a href="#/app">Web wallet</a><a href="#download">Download</a><a href="/chains/README.txt">Logo credits</a></nav><span>NEAR testnet preview · MIT · not audited</span></div></footer>
  </div>;
}

function ProofRow({ icon, title, sub, hash, href }: { icon: any; title: string; sub: string; hash?: string; href?: string }) {
  const link = hash ? EXPLORER_TX(hash) : href;
  return <a className="proof-row" href={link} target="_blank" rel="noreferrer"><span className="lock-ico pq">{icon}</span><span><b>{title}</b><small>{sub}{hash ? ` · ${hash.slice(0, 8)}…` : ''}</small></span><ExternalLink size={16} color="var(--text-3)" /></a>;
}

function PhonePreview({ demo, live }: { demo: any; live: Live }) {
  const rows = [
    { id: 'near', name: 'NEAR', amt: live.near !== undefined ? fmt(Number(live.near / 10n ** 20n) / 1e4, 2) : '…', sym: 'NEAR' },
    { id: 'usdt', name: 'USDT', amt: y24(live.usdt), sym: 'on NEAR' },
    { id: 'solana', name: 'wNEAR', amt: y9(live.sol), sym: 'on Solana' },
    { id: 'bitcoin', name: 'Bitcoin', amt: '0', sym: 'testnet3' },
    { id: 'zcash', name: 'Zcash', amt: '—', sym: 'testnet' },
  ];
  return <div className="phone rise" style={{ animationDelay: '.1s' }}><div className="phone-screen">
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}><span className="brand" style={{ fontSize: 16 }}><Mark size={24} />magen</span><span className="pill pill-green" style={{ height: 22, fontSize: 11 }}><span className="live-dot" />Two locks</span></div>
    <div style={{ marginTop: 22, color: 'var(--text-3)', fontSize: 12 }}>{demo?.account ?? '…'}</div>
    <div style={{ fontFamily: 'var(--display)', fontSize: 40, fontWeight: 600, letterSpacing: '-.045em', lineHeight: 1.1 }} className="num">{rows[0].amt}<small style={{ fontSize: 15, color: 'var(--text-3)', marginLeft: 6 }}>NEAR</small></div>
    <div className="actions4" style={{ marginTop: 16, gap: 8 }}>{[['Receive', ArrowRight], ['Send', Send], ['Swap', Repeat], ['Bridge', Globe]].map(([l, I]: any) => <span key={l} className="action" style={{ padding: '10px 4px', fontSize: 11.5, borderRadius: 14 }}><span className="ai" style={{ width: 32, height: 32 }}><I size={15} /></span>{l}</span>)}</div>
    <div style={{ marginTop: 16, display: 'grid' }}>{rows.map(r => <div key={r.id} className="list-row" style={{ padding: '9px 2px' }}><ChainLogo id={r.id} size="sm" /><span className="mid"><b style={{ fontSize: 13.5 }}>{r.name}</b><small>{r.sym}</small></span><span className="r"><b className="num" style={{ fontSize: 13.5 }}>{r.amt}</b></span></div>)}</div>
  </div></div>;
}

const COLS = ['Magen', 'Phantom', 'Trust', 'Rabby', 'HOT', 'Meteor', 'NEAR Mobile vault', 'QRL'];
const ROWS: [string, string[]][] = [
  ['Bitcoin, Solana and EVM addresses', ['yes', 'yes', 'yes', 'part:EVM only', 'yes', 'part:NEAR first', 'no', 'no']],
  ['Post-quantum signature key', ['yes', 'no', 'no', 'no', 'no', 'yes', 'yes', 'yes']],
  ['Classical + post-quantum on every move', ['yes', 'no', 'no', 'no', 'no', 'no', 'no', 'no']],
  ['PQ key from the same 12 words', ['yes', 'no', 'no', 'no', 'no', 'part:separate', 'no:own seed', 'part:own chain']],
  ['Keeps your existing account', ['yes', '—', '—', '—', '—', 'yes', 'no', 'no']],
  ['Bridge BTC/ZEC under the PQ lock', ['yes', 'no', 'no', 'no', 'part:classical', 'no', 'no', 'no']],
  ['Swaps', ['yes', 'yes', 'yes', 'yes', 'yes', 'yes', 'part', 'no']],
];
function Cell({ v }: { v: string }) {
  const [k, note] = v.split(':');
  if (k === 'yes') return <span className="yes"><Check size={17} /></span>;
  if (k === 'part') return <span className="part">{note ?? 'Partly'}</span>;
  if (k === 'no') return <span className="no">{note ?? '—'}</span>;
  return <span className="no">{k}</span>;
}
function Compare() {
  return <>
    <div className="compare-wrap"><table className="compare">
      <thead><tr><th />{COLS.map((c, i) => <th key={c} className={i === 0 ? 'us' : ''}>{i === 0 ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Mark size={18} />Magen</span> : c}</th>)}</tr></thead>
      <tbody>{ROWS.map(([label, vals]) => <tr key={label}><td>{label}</td>{vals.map((v, i) => <td key={i} className={i === 0 ? 'us' : ''}><Cell v={v} /></td>)}</tr>)}</tbody>
    </table></div>
    <p className="sources">Sources (Nov 2026): Phantom chain support (crypto.news, Sep 2026); Trust Wallet 2026 guide; Rabby is EVM-only; HOT Wallet Chrome listing (MPC + TEE, classical); Meteor ML-DSA rotation (cryptobriefing); <a href="https://www.nearmobile.app/blog/near-mobile-4-1-post-quantum-vaults" target="_blank" rel="noreferrer">NEAR Mobile 4.1 vaults</a> (separate account, can’t convert); <a href="https://www.theqrl.org/" target="_blank" rel="noreferrer">QRL</a> is its own chain. Full notes in the README.</p>
  </>;
}
