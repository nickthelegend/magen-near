import { useMemo, useState } from 'react';
import qrcode from 'qrcode-generator';
import { Check, Copy, X, ExternalLink } from 'lucide-react';
import { ChainLogo } from './chain.tsx';

export function QrCode({ data, label }: { data: string; label?: string }) {
  const svg = useMemo(() => { const q = qrcode(0, 'M'); q.addData(data); q.make(); return q.createSvgTag({ cellSize: 6, margin: 0, scalable: true }); }, [data]);
  return <div className="qr" dangerouslySetInnerHTML={{ __html: svg }} aria-label={label ?? `QR code for ${data}`} />;
}
export function AddrLine({ text }: { text: string }) {
  const [ok, setOk] = useState(false);
  return <div className="addr"><span>{text}</span><button onClick={() => navigator.clipboard?.writeText(text).then(() => { setOk(true); setTimeout(() => setOk(false), 1400); })} aria-label="Copy">{ok ? <Check size={17} /> : <Copy size={17} />}</button></div>;
}
export function ReceiveModal({ chain, onClose }: { chain: { id: string; name: string; network: string; address: string; explorer: string; symbol: string; note?: string }; onClose: () => void }) {
  return <div className="modal-shade" onClick={onClose}><div className="modal" onClick={e => e.stopPropagation()} role="dialog" aria-label={`Receive on ${chain.name}`}>
    <div className="modal-head"><span style={{ display: 'flex', gap: 10, alignItems: 'center' }}><ChainLogo id={chain.id} /><span><h3>Receive {chain.symbol}</h3><small className="card-sub">{chain.name} · {chain.network}</small></span></span><button onClick={onClose} aria-label="Close"><X size={20} /></button></div>
    <div style={{ display: 'grid', justifyItems: 'center' }}><QrCode data={chain.address} /></div>
    <AddrLine text={chain.address} />
    {chain.note && <p className="hint">{chain.note}</p>}
    {chain.explorer && <a className="link" href={chain.explorer} target="_blank" rel="noreferrer">View on explorer <ExternalLink size={14} /></a>}
  </div></div>;
}
