// Writes the PUBLIC side of the demo wallet (addresses and key handles, never the phrase) for the read-only web demo.
import { readFileSync, writeFileSync } from 'node:fs';
import { deriveAll } from '../sdk/hd.ts';
const s = JSON.parse(readFileSync('.demo/v2-main.json', 'utf8'));
const d = deriveAll(s.mnemonic);
writeFileSync('web/public/demo-wallet.json', JSON.stringify({ account: s.account, pqHandle: d.pqHandle, feePqHandle: d.feePqHandle, chains: d.chains.map(({ explorer, ...c }) => c) }, null, 2));
console.log('wrote', d.chains.length, 'chains');
