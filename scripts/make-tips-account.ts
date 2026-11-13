// Creates magen-tips.testnet, the demo dApp's tip recipient. Key kept in .demo/ (gitignored).
import { existsSync, writeFileSync } from 'node:fs';
import { base64, keyString, random, query } from '../sdk/index.ts';
import { createWithHelper } from '../sdk/drillflow.ts';
const account = 'magen-tips.testnet';
if (await query('view_account', account).then(() => true, () => false)) { console.log('exists'); process.exit(0); }
const s = { account, seed: base64.encode(random()) };
if (!existsSync('.demo/tips.json')) writeFileSync('.demo/tips.json', JSON.stringify(s), { mode: 0o600 });
await createWithHelper(account, keyString(s)); console.log('created', account);
