import { useEffect, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, Check, Copy, ExternalLink, Loader2, ShieldAlert, ShieldCheck, Code2, KeyRound } from 'lucide-react';
import { ago, near, short, txUrl, type Activity } from '../lib/chain.ts';
import { useWallet } from '../lib/store.tsx';

export function CopyBtn({ text, label = 'Copy', light = false }: { text: string; label?: string; light?: boolean }) {
  const [ok, setOk] = useState(false);
  return <button aria-label={label} title={label} style={light ? { color: 'inherit' } : undefined}
    onClick={() => { navigator.clipboard?.writeText(text).then(() => { setOk(true); setTimeout(() => setOk(false), 1400); }); }}>
    {ok ? <Check size={16} /> : <Copy size={16} />}
  </button>;
}

export const TxLink = ({ hash, label }: { hash: string; label?: string }) =>
  <a className="link" href={txUrl(hash)} target="_blank" rel="noreferrer">{label ?? short(hash, 6, 4)} <ExternalLink size={13} /></a>;

export const Spinner = ({ size = 16 }: { size?: number }) => <Loader2 size={size} className="spin" />;

export function Gauge({ score, light = false }: { score: number; light?: boolean }) {
  const [v, setV] = useState(0);
  useEffect(() => { const t = setTimeout(() => setV(score), 60); return () => clearTimeout(t); }, [score]);
  const r = 70, c = 2 * Math.PI * r;
  const color = score >= 85 ? '#8fa8ff' : score >= 40 ? '#f0b44c' : '#ff6b6f';
  return <div className="gauge" aria-label={`Readiness ${score} of 100`}>
    <svg viewBox="0 0 160 160"><circle cx="80" cy="80" r={r} fill="none" stroke={light ? '#e4e7ec' : 'rgba(255,255,255,.1)'} strokeWidth="12" />
      <circle cx="80" cy="80" r={r} fill="none" stroke={color} strokeWidth="12" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - v / 100)} style={{ transition: 'stroke-dashoffset .9s cubic-bezier(.2,.7,.2,1)' }} /></svg>
    <div className="gauge-n"><b>{score}</b><span>of 100 ready</span></div>
  </div>;
}

const icon = (k: Activity['kind']) => k === 'sent' ? <ArrowUpRight size={18} /> : k === 'received' ? <ArrowDownLeft size={18} /> : k === 'refused' ? <ShieldAlert size={18} /> : k === 'upgrade' ? <ShieldCheck size={18} /> : k === 'qday' ? <KeyRound size={18} /> : <Code2 size={18} />;
export function ActivityRow({ a }: { a: Activity }) {
  return <a className="act-row" href={txUrl(a.hash)} target="_blank" rel="noreferrer">
    <span className={`act-ic ${a.kind}`}>{icon(a.kind)}</span>
    <span style={{ minWidth: 0 }}><b>{a.title}</b><small>{a.detail} · {ago(a.time)}</small></span>
    <span className="act-amt">
      {a.amount && a.kind !== 'refused' ? <span className={a.kind === 'received' ? 'pos' : 'neg'}>{a.kind === 'received' ? '+' : '−'}{near(a.amount, 2)} <small>NEAR</small></span>
        : a.kind === 'refused' ? <span className="pill pill-red">Refused</span>
        : <span className={`pill ${a.success ? 'pill-green' : 'pill-red'}`}>{a.success ? 'Done' : 'Failed'}</span>}
    </span>
  </a>;
}

export function ReadOnlyBar() {
  const { readOnly, hasBackup } = useWallet();
  if (!readOnly) return null;
  return <div className="readonly-bar">
    <span className="pill pill-gray">View only</span>
    <span className="grow">Live demo account on NEAR testnet</span>
    <a className="btn btn-primary btn-sm" href="#/start">{hasBackup ? 'Unlock' : 'Create wallet'}</a>
  </div>;
}

export function useAsync<T>(fn: () => Promise<T>, deps: any[]) {
  const [state, set] = useState<{ data?: T; error?: string; loading: boolean }>({ loading: true });
  useEffect(() => {
    let live = true; set(s => ({ ...s, loading: true }));
    fn().then(data => live && set({ data, loading: false })).catch(e => live && set({ error: String(e.message || e), loading: false }));
    return () => { live = false; };
  }, deps);
  return state;
}

import { Component, type ReactNode } from 'react';
/** Shows a readable error instead of a blank screen if a page throws. */
export class Boundary extends Component<{ children: ReactNode }, { error?: string }> {
  state: { error?: string } = {};
  static getDerivedStateFromError(e: any) { return { error: String(e?.message ?? e) }; }
  render() {
    if (this.state.error) return <div className="card card-pad"><div className="banner banner-red"><strong>This screen hit an error</strong>{this.state.error}</div><button className="btn btn-light btn-sm" style={{ marginTop: 12 }} onClick={() => this.setState({ error: undefined })}>Try again</button></div>;
    return this.props.children;
  }
}
