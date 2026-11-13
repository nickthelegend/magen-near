import { useState } from 'react';
import { RefreshCw, ExternalLink } from 'lucide-react';
import { useWallet } from '../lib/store.tsx';
import { accountUrl, readActivity, type Activity as A } from '../lib/chain.ts';
import { ActivityRow, ReadOnlyBar, useAsync } from '../ui/bits.tsx';

const FILTERS: { id: string; label: string; test: (a: A) => boolean }[] = [
  { id: 'all', label: 'All', test: () => true },
  { id: 'sent', label: 'Sent', test: a => a.kind === 'sent' || a.kind === 'call' },
  { id: 'received', label: 'Received', test: a => a.kind === 'received' },
  { id: 'refused', label: 'Refused', test: a => a.kind === 'refused' },
  { id: 'security', label: 'Security', test: a => a.kind === 'upgrade' || a.kind === 'qday' },
];

export function Activity() {
  const { account } = useWallet();
  const [f, setF] = useState('all'); const [n, setN] = useState(0);
  const acts = useAsync(() => readActivity(account, 40), [account, n]);
  const list = (acts.data ?? []).filter(FILTERS.find(x => x.id === f)!.test);
  const refused = (acts.data ?? []).filter(a => a.kind === 'refused').length;
  return <>
    <ReadOnlyBar />
    <h1 className="page-title-m only-m">Activity</h1>
    <section className="card rise">
      <div className="card-head" style={{ flexWrap: 'wrap' }}>
        <div className="filters">{FILTERS.map(x => <button key={x.id} className={f === x.id ? 'on' : ''} onClick={() => setF(x.id)}>{x.label}{x.id === 'refused' && refused ? ` · ${refused}` : ''}</button>)}</div>
        <span style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
          <button className="link" onClick={() => setN(v => v + 1)}><RefreshCw size={14} />Refresh</button>
          <a className="link hide-m" href={accountUrl(account)} target="_blank" rel="noreferrer">Explorer <ExternalLink size={13} /></a>
        </span>
      </div>
      <div className="acts" style={{ marginTop: 12 }}>
        {acts.loading && !acts.data ? [0, 1, 2, 3, 4].map(i => <div className="act-row" key={i}><span className="skel" style={{ width: 40, height: 40 }} /><span className="skel" style={{ height: 16 }} /><span /></div>)
          : acts.error ? <div className="empty"><b>History is unavailable</b>{acts.error}</div>
          : list.length ? list.map(a => <ActivityRow key={a.hash} a={a} />)
          : <div className="empty"><img src="/art/empty-activity.webp" alt="" /><b>Nothing here yet</b>{f === 'refused' ? 'No refused payments. Try the drill to see one.' : 'Transactions appear here once NEAR records them.'}</div>}
      </div>
    </section>
    <p className="hint">History comes from the NearBlocks API; each wallet action is decoded from its on-chain arguments. Refusals are real failed transactions with the contract’s reason.</p>
  </>;
}
