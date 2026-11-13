import { useState } from 'react';
import { Atom, Copy, Check, ExternalLink, ShieldCheck, ShieldAlert, Link2 } from 'lucide-react';
import { useWallet, feeSigner } from '../lib/store.tsx';
import { friendlyError, short, txUrl } from '../lib/chain.ts';
import { allAddresses, ethAssemble, ethSigningHash, evm, gatedSign, toHex, type EthTx } from '../../../sdk/chains.ts';
import { ReadOnlyBar, Spinner, TxLink, useAsync } from '../ui/bits.tsx';

const SEPOLIA = 'https://ethereum-sepolia-rpc.publicnode.com';
const EXPLORERS: Record<string, (a: string) => string> = {
  ethereum: a => `https://sepolia.etherscan.io/address/${a}`,
  bitcoin: a => `https://mempool.space/testnet4/address/${a}`,
  solana: a => `https://explorer.solana.com/address/${a}?cluster=devnet`,
  cosmos: a => `https://www.mintscan.io/cosmoshub-testnet/address/${a}`,
};
const GLYPH: Record<string, string> = { ethereum: 'Ξ', bitcoin: '₿', solana: 'S', cosmos: 'A' };

function CopyText({ text }: { text: string }) {
  const [ok, setOk] = useState(false);
  return <button aria-label="Copy address" onClick={() => navigator.clipboard?.writeText(text).then(() => { setOk(true); setTimeout(() => setOk(false), 1200); })} style={{ color: 'var(--text-3)', display: 'inline-flex' }}>{ok ? <Check size={15} /> : <Copy size={15} />}</button>;
}

export function Chains() {
  const { account, vault, live } = useWallet();
  const addrs = useAsync(() => allAddresses(account), [account]);
  const run = useAsync(() => fetch('/chains-live.json').then(r => r.json()), []);
  const eth = addrs.data?.find(a => a.id === 'ethereum');
  const [to, setTo] = useState(''); const [amt, setAmt] = useState('0.001'); const [dropPq, setDropPq] = useState(false);
  const [busy, setBusy] = useState(''); const [err, setErr] = useState('');
  const [res, setRes] = useState<{ near?: { hash: string; success: boolean; error: string }; raw?: string; sepolia?: string; needsGas?: boolean } | null>(null);

  const sign = async () => {
    if (!vault || !eth) return; setErr(''); setRes(null);
    try {
      if (!/^0x[0-9a-fA-F]{40}$/.test(to.trim())) throw Error('Enter an Ethereum address (0x…).');
      const wei = BigInt(Math.round(Number(amt) * 1e9)) * 10n ** 9n;
      setBusy('Reading Sepolia nonce and gas…');
      const [nonce, gasPrice, bal] = await Promise.all([evm(SEPOLIA, 'eth_getTransactionCount', [eth.address, 'latest']), evm(SEPOLIA, 'eth_gasPrice', []), evm(SEPOLIA, 'eth_getBalance', [eth.address, 'latest'])]);
      const maxFee = BigInt(gasPrice) * 2n;
      const tx: EthTx = { chainId: 11155111n, nonce: BigInt(nonce), maxPriorityFeePerGas: 1_000_000_000n > maxFee ? maxFee : 1_000_000_000n, maxFeePerGas: maxFee, gas: 21000n, to: to.trim(), value: wei };
      setBusy(dropPq ? 'Asking NEAR with the classical signature only…' : 'Signing twice; NEAR checks both, then asks the MPC…');
      const r = await gatedSign(feeSigner(vault, live), vault.wallet, vault.keys, { Ecdsa: toHex(ethSigningHash(tx)) }, eth.path, 0, { dropPq });
      if (!r.success || !r.signature) { setRes({ near: r }); return; }
      const raw = ethAssemble(tx, r.signature, eth.address);
      const cost = wei + 21000n * maxFee;
      if (BigInt(bal) < cost) { setRes({ near: r, raw, needsGas: true }); return; }
      setBusy('Broadcasting to Sepolia…');
      setRes({ near: r, raw, sepolia: await evm(SEPOLIA, 'eth_sendRawTransaction', [raw]) });
    } catch (e: any) { setErr(friendlyError(String(e.message))); } finally { setBusy(''); }
  };

  const d = run.data;
  return <>
    <ReadOnlyBar />
    <h1 className="page-title-m only-m">Chains</h1>
    <section className="card card-pad rise" style={{ display: 'grid', gap: 10 }}>
      <h2 style={{ fontSize: 24, fontWeight: 650, letterSpacing: '-.02em' }}>One quantum-safe key controls all your chains.</h2>
      <p className="hint" style={{ fontSize: 14.5, maxWidth: '72ch' }}>These addresses come from NEAR Chain Signatures and belong to <b className="mono">{short(account, 18, 8)}</b>. The MPC signs for them only when your Magen wallet asks, and the wallet asks only after ed25519 and ML-DSA-65 both verify on NEAR. The other chains’ own signatures, and the MPC network, are still classical: the control is quantum-safe, the chains are not.</p>
    </section>
    <div className="chains">
      {addrs.loading && !addrs.data ? [0, 1, 2, 3].map(i => <div key={i} className="card card-pad"><div className="skel" style={{ height: 60 }} /></div>)
        : addrs.error ? <div className="card card-pad"><div className="banner banner-red"><ShieldAlert size={18} /><div>Couldn’t read the MPC signer: {addrs.error}</div></div></div>
        : addrs.data!.map(a => <div className="card chain rise" key={a.id}>
          <div className="chain-top"><span className="chain-ico">{GLYPH[a.id]}</span><span><b>{a.name}</b><small>{a.network}</small></span><span className="pill pill-blue"><Atom size={12} />Guarded by your quantum key</span></div>
          <div className="addr" style={{ fontSize: 13.5 }}><span className="mono" style={{ overflowWrap: 'anywhere' }}>{a.address}</span><CopyText text={a.address} /></div>
          <div className="chain-meta"><span>{a.scheme} · MPC domain {a.domain} · path <span className="mono">{a.path}</span></span><a className="link" href={EXPLORERS[a.id](a.address)} target="_blank" rel="noreferrer">Explorer <ExternalLink size={12} /></a></div>
        </div>)}
    </div>
    <div className="grid2">
      <section className="card card-pad rise" style={{ display: 'grid', gap: 14, alignContent: 'start' }}>
        <h2 style={{ fontSize: 17, fontWeight: 600, display: 'flex', gap: 8, alignItems: 'center' }}><Link2 size={18} />Send on Ethereum Sepolia</h2>
        <label className="field"><span>To</span><input className="input mono" placeholder="0x…" value={to} onChange={e => setTo(e.target.value)} spellCheck={false} /></label>
        <label className="field"><span>Amount (Sepolia ETH)</span><input className="input" inputMode="decimal" value={amt} onChange={e => setAmt(e.target.value.replace(/[^\d.]/g, ''))} /></label>
        <div className="toggle"><span><b>Leave out the quantum half</b><small>Ask the MPC with the classical signature only. NEAR refuses.</small></span>
          <button className={`switch ${dropPq ? 'on' : ''}`} role="switch" aria-checked={dropPq} aria-label="Leave out the quantum half" onClick={() => setDropPq(v => !v)} /></div>
        {vault ? <button className={`btn ${dropPq ? 'btn-danger' : 'btn-primary'}`} onClick={sign} disabled={!!busy || !eth}>{busy ? <><Spinner />{busy}</> : dropPq ? 'Request with one signature (test)' : 'Sign twice, then ask the MPC'}</button>
          : <a className="btn btn-dark" href="#/start">Unlock to sign</a>}
        {err && <div className="banner banner-red"><ShieldAlert size={18} /><div>{err}</div></div>}
        {res?.near && !res.near.success && <div className="result bad"><h3><ShieldAlert size={20} color="var(--red)" />{friendlyError(res.near.error)}</h3><p>NEAR never forwarded the request, so the MPC signed nothing.</p><TxLink hash={res.near.hash} label="View the refusal" /></div>}
        {res?.raw && <div className="result ok"><h3><ShieldCheck size={20} color="var(--green)" />MPC signature returned after both your signatures verified.</h3>
          <p className="mono" style={{ fontSize: 11.5, overflowWrap: 'anywhere' }}>{res.raw.slice(0, 120)}…</p>
          <TxLink hash={res.near!.hash} label="View the NEAR request" />
          {res.sepolia ? <a className="link" href={`https://sepolia.etherscan.io/tx/${res.sepolia}`} target="_blank" rel="noreferrer">Sepolia transaction <ExternalLink size={12} /></a>
            : res.needsGas && <div className="banner banner-gray"><div><strong>Needs Sepolia gas.</strong>Fund <span className="mono">{eth?.address}</span> with test ETH, then sign again to broadcast.</div></div>}
        </div>}
      </section>
      <section className="card card-pad rise" style={{ display: 'grid', gap: 12, alignContent: 'start' }}>
        <h2 style={{ fontSize: 17, fontWeight: 600 }}>Recorded live run</h2>
        {d ? <>
          <div className="act-row" style={{ padding: '10px 0' }}><span className="act-ic refused"><ShieldAlert size={18} /></span><span><b>MPC request without the ML-DSA-65 half</b><small>{friendlyError(d.refused_without_ml_dsa.error)}</small></span><a className="link" href={txUrl(d.refused_without_ml_dsa.hash)} target="_blank" rel="noreferrer">{short(d.refused_without_ml_dsa.hash)}</a></div>
          <div className="act-row" style={{ padding: '10px 0' }}><span className="act-ic sent"><ShieldCheck size={18} /></span><span><b>Dual-signed request → ECDSA signature</b><small>v1.signer-prod.testnet, path magen/eth</small></span><a className="link" href={txUrl(d.gated_sign.hash)} target="_blank" rel="noreferrer">{short(d.gated_sign.hash)}</a></div>
          <div className="act-row" style={{ padding: '10px 0' }}><span className="act-ic received"><Check size={18} /></span><span><b>0.05 ETH sent on a local Ethereum chain</b><small>Anvil, block {d.ethereum_local.block}: {short(d.ethereum_local.tx, 10, 6)}</small></span><span className="pill pill-green">Success</span></div>
          <p className="hint">Public Sepolia and devnet faucets need a login or CAPTCHA, so the recorded broadcast used a local chain. The NEAR side is public testnet.</p>
        </> : <div className="skel" style={{ height: 120 }} />}
      </section>
    </div>
  </>;
}
