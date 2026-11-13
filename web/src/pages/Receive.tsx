import { useMemo, useState } from 'react';
import qrcode from 'qrcode-generator';
import { Copy, Check, Share2, Info } from 'lucide-react';
import { useWallet } from '../lib/store.tsx';
import { ReadOnlyBar } from '../ui/bits.tsx';

export function Receive() {
  const { account } = useWallet();
  const [ok, setOk] = useState(false);
  const svg = useMemo(() => { const q = qrcode(0, 'M'); q.addData(account); q.make(); return q.createSvgTag({ cellSize: 6, margin: 0, scalable: true }); }, [account]);
  const copy = () => navigator.clipboard?.writeText(account).then(() => { setOk(true); setTimeout(() => setOk(false), 1500); });
  return <>
    <ReadOnlyBar />
    <h1 className="page-title-m only-m">Receive</h1>
    <section className="card receive rise">
      <div className="qr-side"><div className="qr" dangerouslySetInnerHTML={{ __html: svg }} aria-label={`QR code for ${account}`} /></div>
      <div className="receive-body">
        <div><h2 style={{ fontSize: 26, letterSpacing: '-.02em', fontWeight: 650 }}>Your account name is your address.</h2>
          <p className="lede" style={{ fontSize: 15.5, marginTop: 8 }}>Anyone can send NEAR here from any wallet or exchange that supports testnet. Nothing special is needed on their side.</p></div>
        <div className="addr"><span className="mono" style={{ fontSize: 15 }}>{account}</span><button onClick={copy} aria-label="Copy address">{ok ? <Check size={18} /> : <Copy size={18} />}</button></div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button className="btn btn-dark" onClick={copy}>{ok ? <Check size={17} /> : <Copy size={17} />}{ok ? 'Copied' : 'Copy address'}</button>
          {'share' in navigator && <button className="btn btn-light" onClick={() => (navigator as any).share({ text: account }).catch(() => {})}><Share2 size={17} />Share</button>}
        </div>
        <div className="banner banner-blue"><Info size={18} /><div><strong>Receiving needs no signature.</strong>Incoming NEAR lands straight in the account. Only spending needs both locks.</div></div>
      </div>
    </section>
  </>;
}
