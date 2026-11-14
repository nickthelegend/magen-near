import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Check, Chrome, X, FolderOpen, MousePointerClick, Terminal, Puzzle, Smartphone, Globe, Download, KeyRound, Atom, ArrowUpRight, ExternalLink, Repeat, Send, Bitcoin, ShieldCheck, Sparkles, Plus, EyeOff, Layers, Zap } from 'lucide-react';
import { Brand, Mark } from '../ui/Logo.tsx';
import { motion, AnimatePresence } from 'framer-motion';
import { Reveal, Stagger, Item, EASE } from '../ui/motion.tsx';
import { ChainLogo } from '../ui/chain.tsx';
import { rpc } from '../../../sdk/index.ts';
import { RPCS } from '../../../sdk/scan.ts';
import { demoWallet, fmt } from '../lib/multi.ts';
import { readAccount } from '../lib/chain.ts';
import { ftBalance } from '../../../sdk/swap.ts';
import { splBalance } from '../../../sdk/omni.ts';

const EXPLORER_TX = (h: string) => `https://testnet.nearblocks.io/txns/${h}`;
const BTC_DEPOSIT_TX = 'a4da59b2277db9312b8e871e3e70cb3ea26e285b8db3e06b3ba7193a760f7c7c';
const BTC_DEPOSIT_ADDR = 'tb1qtm9msd7h3fhpm9t6l5gpj3uapfqumztut66ww7';
type Live = { height?: number; protocol?: number; near?: bigint; usdt?: bigint; sol?: bigint; nbtc?: bigint; nzec?: bigint };
function useLive(account: string | null) {
  const [l, set] = useState<Live>({});
  useEffect(() => {
    if (!account) return;
    let on = true;
    const load = async () => {
      const [st, acc, usdt, sol, nbtc, nzec] = await Promise.allSettled([rpc('status', [], RPCS.testnet), readAccount(account), ftBalance('usdt.itachicara.testnet', account), demoWallet().then(d => splBalance(d.chains.find((c: any) => c.id === 'solana').address)), ftBalance('nbtc.n-bridge.testnet', account), ftBalance('nzcash.n-bridge.testnet', account)]);
      if (!on) return;
      const ok = <T,>(r: PromiseSettledResult<T>) => r.status === 'fulfilled' ? r.value : undefined;
      set({
        height: ok(st)?.sync_info.latest_block_height, protocol: ok(st)?.protocol_version,
        near: ok(acc)?.amount, usdt: ok(usdt), sol: ok(sol)?.amount, nbtc: ok(nbtc), nzec: ok(nzec),
      });
    };
    load(); const t = setInterval(load, 6000); return () => { on = false; clearInterval(t); };
  }, [account]);
  return l;
}
const y24 = (v?: bigint) => v === undefined ? '…' : fmt(Number(v / 10n ** 18n) / 1e6, 4);
const y9 = (v?: bigint) => v === undefined ? '…' : fmt(Number(v) / 1e9, 4);
const y8 = (v?: bigint) => v === undefined ? '…' : fmt(Number(v) / 1e8, 6);

const ORBIT: [string, number, number, number][] = [ // id, x%, y%, size
  ['bitcoin', 14, 30, 64], ['zcash', 7, 62, 52], ['ethereum', 21, 80, 56], ['usdt', 27, 50, 48],
  ['solana', 83, 26, 76], ['base', 79, 68, 52], ['avalanche', 92, 82, 58], ['arbitrum', 73, 47, 46],
];

export function Landing() {
  const [demo, setDemo] = useState<any>(null);
  const [proof, setProof] = useState<any[]>([]);
  useEffect(() => { demoWallet().then(setDemo).catch(() => {}); fetch('/v2-live.json').then(r => r.json()).then(d => setProof(d.runs ?? [])).catch(() => {}); }, []);
  const live = useLive(demo?.account ?? null);
  const [get, setGet] = useState<Get | null>(null);
  useEffect(() => {
    const read = () => { const h = location.hash.slice(1); if (h === 'iphone' || h === 'chrome') setGet(h); };
    read();
    // A page opened at /#download (or any section) lands on that section once it has rendered.
    const h = location.hash; if (h && !h.startsWith('#/') && h !== '#iphone' && h !== '#chrome') setTimeout(() => document.getElementById(h.slice(1))?.scrollIntoView(), 300);
    addEventListener('hashchange', read); return () => removeEventListener('hashchange', read);
  }, []);
  const closeGet = () => { setGet(null); if (location.hash === '#iphone' || location.hash === '#chrome') history.replaceState(null, '', location.pathname + location.search); };
  const swap = proof.find(p => p.what?.startsWith('swap') && p.success);
  const out = proof.find(p => p.what?.startsWith('bridge out') && p.success);
  const create = proof.find(p => p.what?.startsWith('create') && p.success);

  return <div className="landing w2">
    <header className="w2-hero">
      <div className="w2-ray" aria-hidden="true" /><div className="w2-dots" aria-hidden="true" />
      <nav className="w2-nav"><Brand size={34} />
        <div className="w2-links"><a href="#features">Wallet</a><a href="#how">Bridge</a><a href="#compare">Compare</a><a href="#qday">Q-Day</a><a href="#download">Download</a></div>
        <a className="w2-cta" href="#/app">Open Wallet<span><ArrowRight size={16} /></span></a>
      </nav>
      <Stagger className="w2-head" inView={false} gap={0.12}>
        <Item><span className="w2-chip"><span className="w2-chip-ico"><ShieldCheck size={13} /></span>The Quantum Risk · Every Chain</span></Item>
        <Item><h1>Every Chain's Keys Are <motion.span className="w2-box" initial={{ scale: .86, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: .45, type: 'spring', stiffness: 220, damping: 16 }}>Quantum-Exposed</motion.span><br />Magen Adds The Lock</h1></Item>
        <Item><p className="w2-sub">Bitcoin, Ethereum, Solana and NEAR all sign with ECDSA or EdDSA keys. Shor's algorithm on a large quantum computer can recover a private key from its public key, and every account that has signed has already revealed it. Magen adds a NIST-standard ML-DSA-65 lock on NEAR and puts every chain behind it.</p></Item>
        <Item className="w2-stores">
          <a className="w2-store" href="#iphone"><Smartphone size={24} /><span><small>Download for</small>iPhone</span></a>
          <a className="w2-store" href="#chrome"><Chrome size={24} /><span><small>Add to</small>Chrome</span></a>
          <a className="w2-store" href="#/app"><Globe size={24} /><span><small>Open the</small>Web wallet</span></a>
        </Item>
      </Stagger>
      <div className="w2-stage">
        <svg className="w2-orbits" viewBox="0 0 1200 520" preserveAspectRatio="none" aria-hidden="true">
          {[[560, 440], [430, 330], [300, 230]].map(([rx, ry], i) => <motion.ellipse key={rx} cx="600" cy="560" rx={rx} ry={ry} initial={{ pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: 1 }} transition={{ duration: 1.6, delay: .3 + i * .15, ease: EASE }} />)}
        </svg>
        {ORBIT.map(([id, x, y, s], i) => <span key={id} className="w2-orb" style={{ left: `${x}%`, top: `${y}%`, width: s, height: s, animationDelay: `${i * .4}s` }}><motion.span className="w2-orb-in" initial={{ scale: 0, rotate: -40 }} animate={{ scale: 1, rotate: 0 }} transition={{ delay: .7 + i * .08, type: 'spring', stiffness: 260, damping: 15 }}><ChainLogo id={id} /></motion.span></span>)}
        <PhoneW2 demo={demo} live={live} />
      </div>
    </header>

    <section className="w2-sec" id="risk"><Reveal className="w2-panel q-risk">
      <Reveal className="w2-sechead"><span className="w2-chip"><span className="w2-chip-ico"><ShieldCheck size={13} /></span>Harvest Now, Crack Later</span><h2>Four Chains, One Weakness</h2></Reveal>
      <Stagger className="q-row" gap={0.1}>
        {([['bitcoin', 'Bitcoin', 'ECDSA / Schnorr · secp256k1'], ['ethereum', 'Ethereum', 'ECDSA · secp256k1'], ['solana', 'Solana', 'EdDSA · Ed25519'], ['near', 'NEAR', 'EdDSA · Ed25519']] as const).map(([id, name, alg]) =>
          <Item key={id} className="q-chip"><ChainLogo id={id} /><b>{name}</b><small>{alg}</small><span className="q-exp">Public key exposed once it signs</span></Item>)}
        <Item className="q-arrow"><ArrowRight size={26} /></Item>
        <Item className="q-lock"><Mark size={46} /><b>Magen lock</b><small>ML-DSA-65 · NIST FIPS 204 (Aug 2024)</small><span className="q-ok">Verified on NEAR before any chain is signed</span></Item>
      </Stagger>
      <p className="q-src">Sources: <a href="https://csrc.nist.gov/pubs/fips/204/final" target="_blank" rel="noreferrer">NIST FIPS 204, Module-Lattice-Based Digital Signature Standard (Aug 13, 2024)</a> · <a href="https://arxiv.org/abs/quant-ph/9508027" target="_blank" rel="noreferrer">P. Shor, polynomial-time algorithms for discrete logarithms (1994/1995)</a>. No date for a large quantum computer is claimed here.</p>
    </Reveal></section>

    <section className="w2-sec" id="features"><Reveal className="w2-panel">
      <Reveal className="w2-sechead"><span className="w2-chip"><span className="w2-chip-ico"><Zap size={13} /></span>Simple, Live And Quantum-Safe</span><h2>Every Chain, One Quantum-Safe Lock</h2></Reveal>
      <Stagger className="w2-feat" gap={0.1}>
        <FeatCard icon={<Layers size={20} />} title="One Seed, Every Chain" text="Twelve words open Bitcoin, Zcash, Ethereum, Solana, Base and more, plus your ML-DSA-65 key." href="#/app/chains" />
        <FeatCard icon={<Bitcoin size={20} />} title="Bridge BTC And ZEC In" text="Your own deposit address on Bitcoin and Zcash. Coins arrive on NEAR as nBTC and nZEC." href="#/app/bridge" />
        <Item className="w2-portrait">
          <motion.img initial={{ scale: 1.12 }} whileInView={{ scale: 1 }} viewport={{ once: true }} transition={{ duration: 1.4, ease: EASE }} src="/v5/shield-tall.jpg" alt="A matte magenta shield on a plinth, circled by floating coins" width={1024} height={1536} />
          <a className="w2-toast" href={`https://mempool.space/testnet/tx/${BTC_DEPOSIT_TX}`} target="_blank" rel="noreferrer"><ChainLogo id="bitcoin" size="sm" /><span><b>4,000 sats</b><small>BTC sent to your deposit address</small></span></a>
        </Item>
        <FeatCard icon={<KeyRound size={20} />} title="Signed Twice, Every Move" text="ed25519 and ML-DSA-65 both sign. NEAR checks both before anything moves." href="#/app/security" />
        <FeatCard icon={<EyeOff size={20} />} title="Private Send" text="Send to a one-time stealth address only the receiver can find, with a quantum-safe key exchange." href="#/app/private" />
      </Stagger>
      <div className="w2-live">
        <span className="clogo-stack">{['near', 'bitcoin', 'zcash', 'ethereum', 'solana'].map(id => <ChainLogo key={id} id={id} size="sm" />)}</span>
        <span className="w2-live-t"><span className="live-dot" />Live on NEAR testnet · block <b className="num">{live.height?.toLocaleString() ?? '…'}</b> · protocol {live.protocol ?? '…'}</span>
        <a className="w2-cta sm" href="#/app">Try The Wallet<span><ArrowRight size={14} /></span></a>
      </div>
    </Reveal></section>

    <section className="w2-sec"><Stagger className="w2-bento" gap={0.1}>
      <Item className="w2-b-photo big"><motion.img initial={{ scale: 1.1 }} whileInView={{ scale: 1 }} viewport={{ once: true }} transition={{ duration: 1.4, ease: EASE }} src="/v5/orbit-wide.jpg" alt="" width={1536} height={1024} />
        <Stagger className="w2-toasts" gap={0.18}>
          {create && <motion.a variants={{ hide: { opacity: 0, x: -40 }, show: { opacity: 1, x: 0, transition: { type: "spring", stiffness: 200, damping: 20 } } }} className="w2-toast" href={EXPLORER_TX(create.hash)} target="_blank" rel="noreferrer"><Mark size={26} /><span><b>Wallet created</b><small>from 12 words, both locks on</small></span></motion.a>}
          {swap && <motion.a variants={{ hide: { opacity: 0, x: -40 }, show: { opacity: 1, x: 0, transition: { type: "spring", stiffness: 200, damping: 20 } } }} className="w2-toast" href={EXPLORER_TX(swap.hash)} target="_blank" rel="noreferrer"><ChainLogo id="usdt" size="sm" /><span><b>1 NEAR → {y24(BigInt(swap.received))} USDT</b><small>Swapped on Ref, signed twice</small></span></motion.a>}
          {out && <motion.a variants={{ hide: { opacity: 0, x: -40 }, show: { opacity: 1, x: 0, transition: { type: "spring", stiffness: 200, damping: 20 } } }} className="w2-toast" href={out.destination?.explorer ?? EXPLORER_TX(out.hash)} target="_blank" rel="noreferrer"><ChainLogo id="solana" size="sm" /><span><b>0.5 NEAR → Solana</b><small>Omni Bridge, {out.destination?.seconds_after_init ?? '~15'} s</small></span></motion.a>}
        </Stagger>
      </Item>
      <Item className="w2-b-photo"><img src="/v4/card-ink.jpg" alt="" width={1024} height={1024} /></Item>
      <Item className="w2-b-stat"><span>Checked on chain, every move</span><b className="num">3,309 B</b><small>ML-DSA-65 signature, NIST FIPS 204</small></Item>
      <Item className="w2-b-ready"><h3>Ready To Go Quantum-Safe?</h3><a className="w2-cta sm" href="#/start/create">Create Wallet<span><ArrowRight size={14} /></span></a></Item>
      <Item className="w2-b-photo"><img src="/v4/card-magenta.jpg" alt="" width={1024} height={1024} /></Item>
    </Stagger></section>

    <section className="w2-sec"><div className="w2-mission">
      <div className="w2-ring">
        <span className="w2-chip"><span className="w2-chip-ico"><Sparkles size={13} /></span>The Future Of Self-Custody</span>
        <div className="w2-ring-in"><motion.div className="w2-ring-spin" animate={{ rotate: 360 }} transition={{ duration: 80, repeat: Infinity, ease: 'linear' }}>{['near', 'bitcoin', 'zcash', 'ethereum', 'solana', 'base', 'avalanche', 'arbitrum'].map((id, i) => <span key={id} style={{ ['--a' as any]: `${i * 45}deg` }}><motion.span style={{ display: 'inline-flex' }} animate={{ rotate: -360 }} transition={{ duration: 80, repeat: Infinity, ease: 'linear' }}><ChainLogo id={id} size="lg" /></motion.span></span>)}</motion.div><span className="w2-ring-c"><Mark size={70} /></span></div>
      </div>
      <Reveal className="w2-mission-t" delay={.1}>
        <p>At Magen, we believe <em>your coins</em> should outlive the first quantum computer. That is why every move needs two signatures, <span>one of them quantum-safe, checked by NEAR itself. One seed opens every chain, and bridged coins sit under the same lock.</span></p>
        <a className="w2-cta" href="#how">See How It Works<span><ArrowRight size={16} /></span></a>
      </Reveal>
    </div></section>

    <section className="w2-sec" id="how"><div className="w2-panel">
      <Reveal className="w2-sechead"><span className="w2-chip"><span className="w2-chip-ico"><Repeat size={13} /></span>How Magen Works</span><h2>Quantum-Safe Made Simple</h2></Reveal>
      <div className="w2-how">
        <Stagger className="w2-steps" gap={0.14}>
          <Item className="w2-step"><span className="w2-step-ico"><Sparkles size={18} /></span><span><b>Create Your Wallet</b><small>Write down 12 words. They make every chain address and your ML-DSA-65 key.</small></span></Item>
          <Item className="w2-step on"><span className="w2-step-ico"><Bitcoin size={18} /></span><span><b>Bring Coins To NEAR</b><small>Send BTC or ZEC to your own deposit address. They arrive as nBTC and nZEC.</small></span></Item>
          <Item className="w2-step"><span className="w2-step-ico"><ShieldCheck size={18} /></span><span><b>Every Move, Signed Twice</b><small>Send, swap or bridge out. NEAR checks both signatures or nothing moves.</small></span></Item>
        </Stagger>
        <motion.div className="w2-conv" initial={{ opacity: 0, rotate: 6, y: 40 }} whileInView={{ opacity: 1, rotate: -2, y: 0 }} viewport={{ once: true, margin: "-60px" }} transition={{ type: "spring", stiffness: 120, damping: 16 }}>
          <div className="w2-conv-f"><small>Amount</small><b className="num">0.00004 BTC</b></div>
          <div className="w2-conv-f"><small>From</small><b><ChainLogo id="bitcoin" size="sm" />Bitcoin testnet3</b></div>
          <div className="w2-conv-f"><small>To</small><b><ChainLogo id="near" size="sm" />nBTC on NEAR</b></div>
          <div className="w2-conv-f"><small>Your deposit address</small><b className="mono" style={{ fontSize: 12.5 }}>{BTC_DEPOSIT_ADDR}</b></div>
          <a className="btn btn-primary btn-block" href="#/app/bridge">Bridge Bitcoin In <ArrowRight size={16} /></a>
        </motion.div>
      </div>
    </div></section>

    <section className="section" id="proof"><div className="wrap">
      <Reveal className="sec-head"><span className="eyebrow"><span className="live-dot" />Live on NEAR testnet</span><h2 className="h2">Real Transactions, Not Promises</h2></Reveal>
      <div className="proof-grid">
        <div className="card"><div className="proof-list">
          {create && <ProofRow icon={<Sparkles size={18} />} title="Wallet created from 12 words" sub="Deploy + both locks + ML-DSA fee key, one tx" hash={create.hash} />}
          {swap && <ProofRow icon={<Repeat size={18} />} title={`Swap 1 NEAR → ${y24(BigInt(swap.received))} USDT`} sub="4 calls, one dual-signed approval, Ref Finance" hash={swap.hash} />}
          {out && <ProofRow icon={<Send size={18} />} title="Bridge 0.5 NEAR to Solana devnet" sub={`Omni Bridge · finalised on Solana in ${out.destination?.seconds_after_init ?? '~15'} s`} hash={out.hash} />}
          <ProofRow icon={<Bitcoin size={18} />} title="4,000 sats to the Bitcoin deposit address" sub="Bitcoin testnet3 · Omni btc-connector" href={`https://mempool.space/testnet/tx/${BTC_DEPOSIT_TX}`} />
        </div></div>
        <div className="stats">
          <div className="stat"><b className="num">{live.height?.toLocaleString() ?? '…'}</b><span>NEAR testnet block, live</span></div>
          <div className="stat"><b>{live.protocol ?? '…'}</b><span>Protocol version (ML-DSA since 87)</span></div>
          <div className="stat"><b className="num">{y24(live.usdt)}</b><span>USDT the demo wallet holds</span></div>
          <div className="stat"><b className="num">{y9(live.sol)}</b><span>wNEAR on its Solana address</span></div>
        </div>
      </div>
    </div></section>

    <section className="section" id="compare"><div className="wrap">
      <Reveal className="sec-head"><span className="eyebrow">Compare</span><h2 className="h2">Multichain Wallets Aren’t Quantum-Safe. Quantum-Safe Wallets Aren’t Multichain.</h2></Reveal>
      <Compare />
    </div></section>

    <section className="section" id="qday"><div className="wrap">
      <Reveal className="sec-head"><span className="eyebrow">Q-Day, simply</span><h2 className="h2">The Day A Quantum Computer Can Forge Today’s Signatures</h2><p className="lede">Magen is ready for both sides of it.</p></Reveal>
      <div className="qday-band">
        <div className="era"><span className="pill">Today</span><h3>Two locks on every move</h3><p>Your classical key and your ML-DSA-65 key both sign. Stealing one gets a thief nothing.</p>
          <div className="sigpair"><div className="sigline"><KeyRound size={15} /><b>ed25519</b><small>required</small></div><div className="sigline" style={{ color: 'var(--mint)' }}><Atom size={15} /><b>ML-DSA-65</b><small>required</small></div></div></div>
        <div className="era after"><span className="pill pill-green">Q-Day switch</span><h3>One tap, quantum-only</h3><p>Flip the switch and NEAR itself lists your ML-DSA-65 key. Then remove the classical key for good.</p>
          <div className="sigpair"><div className="sigline" style={{ opacity: .45 }}><KeyRound size={15} /><b><s>ed25519</s></b><small>removed</small></div><div className="sigline" style={{ color: 'var(--mint)' }}><Atom size={15} /><b>ML-DSA-65</b><small>native NEAR key</small></div></div></div>
      </div>
    </div></section>

    <section className="section" id="limits"><div className="wrap">
      <Reveal className="sec-head"><span className="eyebrow">Honest limits</span><h2 className="h2">What Magen Protects, And What It Can’t</h2></Reveal>
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
      <Reveal className="sec-head"><span className="eyebrow">Download</span><h2 className="h2">Phone, Browser And Web. One Phrase On All Three.</h2></Reveal>
      <div className="get-grid">
        <div className="get-card dark"><span className="get-ico"><Smartphone size={22} /></span><h3>iPhone app</h3><p>Create a wallet, scan, send and swap. Keys stay in the iOS keychain.</p><div className="get-actions"><a className="btn btn-primary btn-sm" href="#iphone"><Download size={15} />Get the iPhone app</a></div><small>iOS Simulator build for the hackathon · TestFlight not set up yet</small></div>
        <div className="get-card"><span className="get-ico"><Chrome size={22} /></span><h3>Chrome extension</h3><p>A popup wallet that dApps reach through <span className="mono">window.magen</span>.</p><div className="get-actions"><a className="btn btn-light btn-sm" href="#chrome"><Download size={15} />Add to Chrome</a></div><small>Load unpacked · not on the Chrome Web Store yet</small></div>
        <div className="get-card"><span className="get-ico"><Globe size={22} /></span><h3>Web wallet</h3><p>Everything, in the browser. Look around the live demo wallet first.</p><div className="get-actions"><a className="btn btn-light btn-sm" href="#/app">Open the web wallet <ArrowUpRight size={15} /></a></div><small>NEAR testnet</small></div>
      </div>
    </div></section>

    <section className="section" id="faq"><div className="wrap">
      <Reveal className="sec-head"><span className="eyebrow">FAQ</span><h2 className="h2">Questions</h2></Reveal>
      <div className="faq">
        <details><summary>What is a quantum-safe key?</summary><p>ML-DSA-65 is a signature scheme NIST standardised in 2024. Today’s keys (ed25519, secp256k1) can be broken by a large quantum computer; ML-DSA is built to resist one. NEAR checks ML-DSA signatures natively since protocol 87.</p></details>
        <details><summary>Why sign twice instead of switching?</summary><p>Hybrid is what European security agencies recommend during the transition: if either scheme has a flaw, the other still holds. When you’re ready, the Q-Day switch makes the ML-DSA key a native NEAR key.</p></details>
        <details><summary>Does this make my Bitcoin quantum-safe?</summary><p>No. Bitcoin’s own keys stay classical. What Magen does is give your coins a quantum-safe home: bridge them to NEAR, where every move needs your ML-DSA signature.</p></details>
        <details><summary>What do the 12 words back up?</summary><p>Every chain address (standard BIP-39/44 paths), your NEAR key and your ML-DSA-65 key, derived from the same seed with HKDF-SHA-256 and the label <span className="mono">magen:ml-dsa-65:v1</span>.</p></details>
        <details><summary>Is it live?</summary><p>On NEAR testnet, yes: every transaction on this page links to the explorer. Not audited, not for real funds yet.</p></details>
      </div>
    </div></section>

    <section className="section"><div className="cta-band w2-ctaband"><Mark size={64} /><h2>Your Coins Deserve A Lock From The Future</h2><a className="w2-cta" href="#/start/create">Create A Wallet<span><ArrowRight size={16} /></span></a></div></section>

    <AnimatePresence>{get && <GetModal key={get} kind={get} onClose={closeGet} demo={demo} live={live} />}</AnimatePresence>

    <footer className="footer"><div className="footer-in"><Brand /><nav><a href="https://github.com/nickthelegend/magen-near" target="_blank" rel="noreferrer">GitHub</a><a href="#/app">Web wallet</a><a href="#download">Download</a><a href="/chains/README.txt">Logo credits</a></nav><span>NEAR testnet preview · MIT · not audited</span></div></footer>
  </div>;
}

function FeatCard({ icon, title, text, href }: { icon: any; title: string; text: string; href: string }) {
  return <Item className="w2-fc" whileHover={{ y: -6, borderColor: 'rgba(224,64,200,.45)' }} transition={{ type: 'spring', stiffness: 300, damping: 22 }}><span className="w2-fc-ico">{icon}</span><h3>{title}</h3><p>{text}</p><a className="w2-more" href={href}>Read More</a></Item>;
}

/** The W2 phone: centred balance, chain avatars, striped asset bars. Live data from the demo wallet. */
function PhoneW2({ demo, live, inline }: { demo: any; live: Live; inline?: boolean }) {
  const nearN = live.near !== undefined ? Number(live.near / 10n ** 20n) / 1e4 : undefined;
  const [w, d] = nearN !== undefined ? fmt(nearN, 2).split('.') : ['…', ''];
  const rows = [
    { id: 'near', name: 'NEAR', amt: nearN !== undefined ? fmt(nearN, 2) : '…', share: .9 },
    { id: 'usdt', name: 'USDT on NEAR', amt: y24(live.usdt), share: .55 },
    { id: 'solana', name: 'wNEAR on Solana', amt: y9(live.sol), share: .35 },
    { id: 'bitcoin', name: 'nBTC', amt: live.nbtc ? y8(live.nbtc) : 'Bridge in', share: 1, max: true },
  ];
  return <motion.div className={`w2-phone${inline ? ' inline' : ''}`} initial={inline ? { y: 60, opacity: 0, rotate: -4 } : { y: 160, opacity: 0, x: '-50%' }} animate={inline ? { y: 0, opacity: 1, rotate: -4 } : { y: 0, opacity: 1, x: '-50%' }} transition={{ delay: inline ? .1 : .35, type: 'spring', stiffness: 70, damping: 16 }}><div className="w2-screen">
    <div className="w2-notch" />
    <div className="w2-bal"><small>Current Balance</small><b className="num">{w}{d && <span>.{d}</span>}<i>NEAR</i></b><small className="mono">{demo?.account ?? '…'}</small></div>
    <div className="w2-avs"><small>Your Chains</small><div>{['near', 'bitcoin', 'zcash', 'ethereum'].map(id => <ChainLogo key={id} id={id} />)}<span className="w2-plus"><Plus size={18} /></span></div></div>
    {rows.map(r => <div key={r.id} className="w2-row"><div className="w2-row-h"><b>{r.name}</b><small>History</small></div>
      <div className="w2-bar"><motion.div className="w2-fill" initial={{ width: 0 }} animate={{ width: `${Math.max(.22, r.share) * 100}%` }} transition={{ delay: 1.1 + rows.indexOf(r) * .12, duration: .9, ease: EASE }}><ChainLogo id={r.id} size="sm" /><b className="num">{r.amt}</b></motion.div></div></div>)}
  </div></motion.div>;
}

function ProofRow({ icon, title, sub, hash, href }: { icon: any; title: string; sub: string; hash?: string; href?: string }) {
  const link = hash ? EXPLORER_TX(hash) : href;
  return <a className="proof-row" href={link} target="_blank" rel="noreferrer"><span className="lock-ico pq">{icon}</span><span><b>{title}</b><small>{sub}{hash ? ` · ${hash.slice(0, 8)}…` : ''}</small></span><ExternalLink size={16} color="var(--text-3)" /></a>;
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

type Get = 'iphone' | 'chrome';
const GET = {
  iphone: {
    file: '/downloads/Magen-NEAR-iOS-Simulator.zip', chip: 'iPhone app', title: 'Magen For iPhone',
    lede: 'The whole wallet as a native iPhone app: create a wallet, scan, send and swap, with your keys in the iOS keychain.',
    button: 'Download for iPhone', buttonSub: 'iOS Simulator build', alt: 'No Mac? Open the web wallet instead',
    honest: 'For the hackathon this is an iOS Simulator build. TestFlight isn’t set up yet, so it runs in Xcode’s Simulator on an Apple-silicon Mac, not on a physical iPhone.',
    steps: [
      { icon: Download, t: 'Download', d: 'Get the .zip above.' },
      { icon: FolderOpen, t: 'Unzip', d: 'Double-click it. You get Magen.app.' },
      { icon: MousePointerClick, t: 'Install', d: 'Open Simulator and drag Magen.app onto the iPhone, or run:', code: 'xcrun simctl install booted Magen.app' },
    ],
  },
  chrome: {
    file: '/downloads/magen-extension.zip', chip: 'Chrome extension', title: 'Magen For Chrome',
    lede: 'A popup wallet beside your tabs. Apps you visit can ask it to sign through window.magen, and you approve each request.',
    button: 'Download for Chrome', buttonSub: 'Chrome extension', alt: 'Rather not install? Open the web wallet instead',
    honest: 'Not on the Chrome Web Store yet, so you load it yourself in developer mode. It takes about a minute.',
    steps: [
      { icon: Download, t: 'Download and unzip', d: 'You get a magen-extension folder.' },
      { icon: Puzzle, t: 'Open extensions', d: 'Go to chrome://extensions and turn on Developer mode, top right.' },
      { icon: MousePointerClick, t: 'Load unpacked', d: 'Click Load unpacked, pick the folder, then pin Magen from the puzzle menu.' },
    ],
  },
} as const;

/** Reads the real file size from the server, so the number is never stale. */
function useFileSize(url: string) {
  const [size, set] = useState<string | null>(null);
  useEffect(() => {
    let on = true;
    fetch(url, { method: 'HEAD' }).then(r => { const n = Number(r.headers.get('content-length')); if (on && r.ok && n > 0) set(`${(n / 1e6).toFixed(1)} MB`); }).catch(() => {});
    return () => { on = false; };
  }, [url]);
  return size;
}

/** The install moment for the iPhone and Chrome buttons: what you get, the real file and three plain steps. */
function GetModal({ kind, onClose, demo, live }: { kind: Get; onClose: () => void; demo: any; live: Live }) {
  const g = GET[kind];
  const size = useFileSize(g.file);
  const close = useRef(onClose); close.current = onClose;
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && close.current();
    addEventListener('keydown', k); document.body.style.overflow = 'hidden';
    return () => { removeEventListener('keydown', k); document.body.style.overflow = ''; };
  }, []);
  return <motion.div className="w2-get-bg" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: .22 }}>
    <motion.div className={`w2-get ${kind}`} role="dialog" aria-modal="true" aria-labelledby="get-title" onClick={e => e.stopPropagation()}
      initial={{ opacity: 0, y: 40, scale: .97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 24, scale: .98 }} transition={{ type: 'spring', stiffness: 260, damping: 26 }}>
      <button className="w2-get-x" onClick={onClose} aria-label="Close" autoFocus><X size={18} /></button>
      <div className="w2-get-art" aria-hidden="true">
        <div className="w2-ray" /><div className="w2-dots" />
        {kind === 'iphone' ? <PhoneW2 demo={demo} live={live} inline />
          : <motion.div className="w2-popup" initial={{ y: 50, opacity: 0, rotate: -3 }} animate={{ y: 0, opacity: 1, rotate: -3 }} transition={{ delay: .1, type: 'spring', stiffness: 80, damping: 16 }}>
            <div className="w2-popup-bar"><i /><i /><i /><span><Puzzle size={13} />Magen</span></div>
            <img src="/v5/ext-popup.jpg" alt="" width={760} height={1200} />
          </motion.div>}
      </div>
      <div className="w2-get-body">
        <span className="w2-chip"><span className="w2-chip-ico">{kind === 'iphone' ? <Smartphone size={13} /> : <Chrome size={13} />}</span>{g.chip}</span>
        <h2 id="get-title">{g.title}</h2>
        <p className="w2-get-lede">{g.lede}</p>
        <a className="w2-get-dl" href={g.file} download>
          <span className="w2-get-dl-ico"><Download size={22} /></span>
          <span><b>{g.button}</b><small>{g.buttonSub}{size ? ` · ${size}` : ''} · .zip</small></span>
          <ArrowRight size={18} />
        </a>
        <p className="w2-get-honest">{g.honest}</p>
        <ol className="w2-get-steps">
          {g.steps.map((s, i) => <li key={s.t}><span className="w2-get-n">{i + 1}</span><span><b>{s.t}</b><small>{s.d}</small>{'code' in s && <code className="w2-get-code"><Terminal size={13} />{s.code}</code>}</span></li>)}
        </ol>
        <a className="w2-get-alt" href="#/app" onClick={onClose}>{g.alt}<ArrowUpRight size={15} /></a>
      </div>
    </motion.div>
  </motion.div>;
}
