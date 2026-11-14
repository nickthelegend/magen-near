import { useEffect, useState } from 'react';
import { ArrowDownToLine, ArrowUpFromLine, ShieldAlert, ShieldCheck, Info, ExternalLink, Check, Loader2, KeyRound, Atom } from 'lucide-react';
import { useWallet, feeSigner } from '../lib/store.tsx';
import { friendlyError, near } from '../lib/chain.ts';
import { nearAmount } from '../../../sdk/index.ts';
import { UTXO, OUT_ROUTES, depositAddress, bridgedBalance, outFee, bridgeOut, outStatus, splBalance, type UtxoChain, type OutRoute } from '../../../sdk/omni.ts';
import { ReadOnlyBar, Spinner, TxLink } from '../ui/bits.tsx';
import { ChainLogo } from '../ui/chain.tsx';
import { QrCode, AddrLine } from '../ui/Qr.tsx';
import { fmt, useChains } from '../lib/multi.ts';

const parts = () => location.hash.replace(/^#\/?/, '').split('/');
export function Bridge() {
  const p = parts();
  const [dir, setDir] = useState<'in' | 'out'>(p[2] === 'out' ? 'out' : 'in');
  return <>
    <ReadOnlyBar />
    <h1 className="page-title-m only-m">Bridge</h1>
    <div><div className="segs"><button className={dir === 'in' ? 'on' : ''} onClick={() => setDir('in')}><ArrowDownToLine size={14} style={{ marginRight: 6, verticalAlign: -2 }} />Bring to NEAR</button><button className={dir === 'out' ? 'on' : ''} onClick={() => setDir('out')}><ArrowUpFromLine size={14} style={{ marginRight: 6, verticalAlign: -2 }} />Send from NEAR</button></div></div>
    {dir === 'in' ? <BridgeIn initial={(p[3] as UtxoChain) === 'zcash' ? 'zcash' : 'btc'} /> : <BridgeOut initial={p[3]} />}
  </>;
}

function BridgeIn({ initial }: { initial: UtxoChain }) {
  const { account } = useWallet();
  const [chain, setChain] = useState<UtxoChain>(initial);
  const [d, setD] = useState<Awaited<ReturnType<typeof depositAddress>> | null>(null);
  const [err, setErr] = useState('');
  const [bal, setBal] = useState<bigint | null>(null);
  const [seen, setSeen] = useState<{ txid: string; value: number; confirmed: boolean; minted?: string }[] | null>(null);
  const c = UTXO[chain];
  useEffect(() => { let on = true; setD(null); setErr(''); depositAddress(chain, account).then(x => on && setD(x)).catch(e => on && setErr(e.message)); return () => { on = false; }; }, [chain, account]);
  useEffect(() => { let on = true; const load = () => bridgedBalance(chain, account).then(b => on && setBal(b)).catch(() => on && setBal(null)); load(); const i = setInterval(load, 15000); return () => { on = false; clearInterval(i); }; }, [chain, account]);
  useEffect(() => {
    if (chain !== 'btc' || !d) { setSeen(null); return; }
    let on = true;
    const load = () => fetch(`https://blockstream.info/testnet/api/address/${d.address}/txs`).then(r => r.json()).then(async (txs: any[]) => {
      const rows = await Promise.all(txs.slice(0, 4).map(async t => {
        const vout = t.vout.findIndex((o: any) => o.scriptpubkey_address === d.address);
        const value = t.vout.filter((o: any) => o.scriptpubkey_address === d.address).reduce((s: number, o: any) => s + o.value, 0);
        // The Omni bridge API says whether the relayer has proved this output to NEAR and minted nBTC.
        const tr = vout < 0 ? null : await fetch(`https://testnet.api.bridge.nearone.org/api/v4/transfers/transfer?utxo_chain=btc&utxo_tx_hash=${t.txid}&utxo_vout=${vout}`, { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(j => j?.transfers?.[0] ?? null).catch(() => null);
        return { txid: t.txid, confirmed: t.status.confirmed, value, minted: tr?.finalised?.transaction_hash as string | undefined };
      }));
      if (on) setSeen(rows);
    }).catch(() => on && setSeen(null));
    load(); const i = setInterval(load, 20000); return () => { on = false; clearInterval(i); };
  }, [chain, d]);
  const conf = d ? String(Object.values(d.confirmations ?? {})[0] ?? '') || null : null;
  return <div className="flow">
    <section className="card flow-main rise">
      <div style={{ display: 'flex', gap: 8 }}>{(Object.keys(UTXO) as UtxoChain[]).map(k => <button key={k} className={`chain-chip ${chain === k ? 'live' : ''}`} style={{ height: 42 }} onClick={() => setChain(k)}><ChainLogo id={k === 'btc' ? 'bitcoin' : 'zcash'} size="sm" />{UTXO[k].name}</button>)}</div>
      <div><h2 style={{ fontSize: 24 }}>Your {c.name} deposit address</h2><p className="hint" style={{ marginTop: 4 }}>Send {c.name} {c.network} here. It arrives on NEAR as {c.symbol}, under your two locks.</p></div>
      {err ? <div className="banner banner-red"><ShieldAlert size={18} /><div><strong>Address not shown</strong>{err}</div></div>
        : !d ? <div className="skel" style={{ height: 260 }} />
        : <div className="receive" style={{ gridTemplateColumns: '220px 1fr' }}>
          <QrCode data={d.address} />
          <div className="receive-body">
            <AddrLine text={d.address} />
            <div className="kv">
              <div><span>Minimum</span><b>{d.minDeposit.toLocaleString()} {c.unit}</b></div>
              <div><span>Confirmations</span><b>{conf ?? '…'}</b></div>
              <div><span>Bridge fee</span><b>from {d.feeMin.toLocaleString()} {c.unit}</b></div>
              <div><span>Checked</span><b><Check size={14} color="var(--mint)" style={{ verticalAlign: -2 }} /> connector and bridge API agree</b></div>
            </div>
          </div>
        </div>}
      {chain === 'zcash' && <div className="banner"><Info size={18} /><div><strong>Send from a transparent output.</strong>This is a t-address, so the deposit is public: bridging removes Zcash’s shielding.</div></div>}
      {seen && seen.length > 0 ? <div className="steps">{seen.map(s => <a key={s.txid} className={`step ${s.minted || s.confirmed ? 'done' : 'active'}`} href={s.minted ? `https://testnet.nearblocks.io/txns/${s.minted}` : c.explorerTx(s.txid)} target="_blank" rel="noreferrer">{s.minted || s.confirmed ? <Check size={16} /> : <Loader2 size={16} className="spin" />}{s.value.toLocaleString()} sats · {s.minted ? `minted as ${c.symbol} on NEAR` : s.confirmed ? 'confirmed, waiting for the relayer' : 'seen, confirming'}<ExternalLink size={14} style={{ marginLeft: 'auto' }} /></a>)}</div>
        : <div className="banner banner-gray"><Info size={18} /><div><strong>Fund to try.</strong>Nothing has arrived yet. Send at least {d ? d.minDeposit.toLocaleString() : '…'} {c.unit} from any {c.name} testnet wallet.</div></div>}
    </section>
    <aside className="card">
      <div className="card-head"><h2>{c.symbol} on NEAR</h2><span className="pill pill-green"><span className="live-dot" />live</span></div>
      <div className="score-line" style={{ margin: '10px 0' }}><b className="num">{bal === null ? '…' : fmt(Number(bal) / 1e8, 8)}</b><span>{c.symbol}</span></div>
      <div className="steps">
        {[`Send ${c.name} to your address`, `${conf ?? 'A few'} confirmations on ${c.name}`, 'Relayer proves it to NEAR', `${c.symbol} minted to your wallet`].map((s, i) => <div key={s} className="step"><span className="mono" style={{ color: 'var(--mint)' }}>{i + 1}</span>{s}</div>)}
      </div>
      <p className="hint" style={{ marginTop: 12 }}>The address is derived on chain by <span className="mono">{c.connector}</span> for your account, and the bridge’s signer is classical MPC. Once on NEAR, moving {c.symbol} needs both of your signatures.</p>
    </aside>
  </div>;
}

function BridgeOut({ initial }: { initial?: string }) {
  const { vault, account, live, refresh, readOnly } = useWallet();
  const { rows } = useChains();
  const [route, setRoute] = useState<OutRoute>(OUT_ROUTES.find(r => r.id === initial) ?? OUT_ROUTES[0]);
  const [amt, setAmt] = useState('0.5');
  const [fee, setFee] = useState<bigint | null>(null);
  const [busy, setBusy] = useState(''); const [err, setErr] = useState('');
  const [res, setRes] = useState<{ hash: string; success: boolean; error: string } | null>(null);
  const [st, setSt] = useState<{ status: string; destTx?: string } | null>(null);
  const [dest, setDest] = useState<number | null>(null);
  const to = rows?.find(r => r.id === route.id)?.address ?? '';
  let amount = 0n; try { amount = amt ? BigInt(nearAmount(amt)) : 0n; } catch { /* invalid */ }
  useEffect(() => { let on = true; setFee(null); if (!to || amount <= 0n) return; outFee(account, route, to, amount).then(q => on && setFee(q.fee)).catch(e => on && setErr(e.message)); return () => { on = false; }; }, [route, to, amt, account]);
  useEffect(() => { if (route.id !== 'solana' || !to) { setDest(null); return; } let on = true; const load = () => splBalance(to).then(b => on && setDest(Number(b.amount) / 10 ** b.decimals)).catch(() => {}); load(); const i = setInterval(load, 8000); return () => { on = false; clearInterval(i); }; }, [route, to, st?.status]);
  useEffect(() => {
    if (!res?.success) return;
    let on = true; const poll = async () => { const s = await outStatus(res.hash).catch(() => null); if (on && s) setSt(s); if (on && s?.status !== 'Finalised' && s?.status !== 'Claimed') setTimeout(poll, 4000); };
    poll(); return () => { on = false; };
  }, [res]);
  const go = async () => {
    if (!vault) return; setErr(''); setRes(null); setSt(null);
    try {
      if (!to) throw Error('This wallet has no address on that chain.');
      setBusy('Signing with both keys…');
      const r = await bridgeOut(feeSigner(vault, live), vault.wallet, vault.keys, route, to, amount);
      setRes(r); refresh();
    } catch (e: any) { setErr(friendlyError(String(e.message))); } finally { setBusy(''); }
  };
  const done = st?.status === 'Finalised' || st?.status === 'Claimed';
  return <div className="flow">
    <section className="card flow-main rise">
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{OUT_ROUTES.map(r => <button key={r.id} className={`chain-chip ${route.id === r.id ? 'live' : ''}`} style={{ height: 42 }} onClick={() => { setRoute(r); setRes(null); setSt(null); }}><ChainLogo id={r.id} size="sm" />{r.chain}</button>)}</div>
      <div className="field"><span>Amount</span><div className="amount-in"><input inputMode="decimal" value={amt} onChange={e => { setAmt(e.target.value.replace(/[^\d.]/g, '')); setRes(null); }} aria-label="Amount in NEAR" /><span style={{ display: 'flex', gap: 8, alignItems: 'center', color: 'var(--text)' }}><ChainLogo id="near" size="sm" />NEAR</span></div>
        <div className="amount-meta"><span>Balance {live?.account ? near(live.account.amount, 4) : '…'} NEAR</span></div></div>
      <div className="summary">
        <div><span>To</span><b className="mono" style={{ fontSize: 12.5 }}>Your {route.chain} address · {to ? `${to.slice(0, 8)}…${to.slice(-6)}` : '…'}</b></div>
        <div><span>Network</span><b>{route.chain} {route.network}</b></div>
        <div><span>Bridge fee</span><b>{fee === null ? '…' : `${fmt(Number(fee / 10n ** 18n) / 1e6, 4)} wNEAR`}</b></div>
        <div><span>Arrives</span><b>{fee !== null && amount > fee ? `${fmt(Number((amount - fee) / 10n ** 18n) / 1e6, 4)} wNEAR on ${route.chain}` : '…'}</b></div>
      </div>
      {err && <div className="banner banner-red"><ShieldAlert size={18} /><div>{err}</div></div>}
      {res && (res.success
        ? <div className={`result ${done ? 'ok' : ''}`}><h3>{done ? <ShieldCheck size={22} color="var(--mint)" /> : <Spinner size={20} />}{done ? `Arrived on ${route.chain}.` : st ? `Bridge status: ${st.status}` : 'Signed on NEAR. Waiting for the bridge relayer…'}</h3>
          <p>Both signatures were checked on NEAR before the bridge got a single token.</p>
          <div className="txline"><TxLink hash={res.hash} label="NEAR transaction" />{st?.destTx && <a className="link" href={route.explorerTx(st.destTx)} target="_blank" rel="noreferrer">{route.chain} transaction <ExternalLink size={13} /></a>}</div></div>
        : <div className="result bad"><h3><ShieldAlert size={22} color="var(--red)" />{friendlyError(res.error)}</h3><TxLink hash={res.hash} label="View the transaction" /></div>)}
      {readOnly ? <a className="btn btn-primary btn-lg btn-block" href="#/start">Create a wallet to bridge</a>
        : <button className="btn btn-primary btn-lg btn-block" onClick={go} disabled={!!busy || !fee || !to}>{busy ? <><Spinner />{busy}</> : <><ArrowUpFromLine size={18} />Bridge · signed twice</>}</button>}
    </section>
    <aside className="card">
      <div className="card-head"><h2>On {route.chain}</h2>{route.id === 'solana' && <span className="pill pill-green"><span className="live-dot" />live</span>}</div>
      {route.id === 'solana' ? <><div className="score-line" style={{ margin: '10px 0' }}><b className="num">{dest === null ? '…' : fmt(dest, 6)}</b><span>wNEAR</span></div><a className="link" href={route.explorerAddr(to)} target="_blank" rel="noreferrer">Your Solana address <ExternalLink size={13} /></a></>
        : <a className="link" href={route.explorerAddr(to)} target="_blank" rel="noreferrer" style={{ marginTop: 10 }}>Your {route.chain} address <ExternalLink size={13} /></a>}
      <div className="sigs" style={{ marginTop: 14 }}>
        <div className="sig"><span className="lock-ico"><KeyRound size={17} /></span><span><b>ed25519</b><small>classical</small></span></div>
        <div className="sig"><span className="lock-ico pq"><Atom size={17} /></span><span><b>ML-DSA-65</b><small>quantum-safe</small></span></div>
      </div>
      <p className="hint" style={{ marginTop: 12 }}>Omni Bridge on testnet. The relayer and the destination chain are classical; what Magen guarantees is that nothing leaves NEAR without your quantum-safe signature.</p>
    </aside>
  </div>;
}
