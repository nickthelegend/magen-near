import { LOGO } from '../lib/multi.ts';
/** Official chain mark (web3icons, MIT) in a round chip; a letter if we have no logo. */
export function ChainLogo({ id, size }: { id: string; size?: 'sm' | 'lg' }) {
  const src = LOGO[id];
  return <span className={`clogo ${size ?? ''}`}>{src ? <img src={src} alt="" /> : <span className="clogo-letter">{id[0]?.toUpperCase()}</span>}</span>;
}
