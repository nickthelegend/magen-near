// Seals the demo wallet (magen-noam.testnet) into an encrypted Magen backup for the v15 film's "Unlock" scene.
// Reads .demo/v2-main.json, writes .demo/v15/noam-backup.json + a random film password (both gitignored, mode 600). Prints nothing secret.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { sealVault } from '../sdk/index.ts';
import { magenKeysFromMnemonic } from '../sdk/hd.ts';
const s = JSON.parse(readFileSync('.demo/v2-main.json', 'utf8'));
const pwFile = '.demo/v15/film-password.txt';
if (!existsSync(pwFile)) writeFileSync(pwFile, 'magen-' + randomBytes(9).toString('base64url'), { mode: 0o600 });
const pw = readFileSync(pwFile, 'utf8').trim();
const mk = magenKeysFromMnemonic(s.mnemonic);
const sealed = await sealVault({ wallet: s.account, keys: mk.keys, relay: { account: s.account, seed: mk.feeSeed, pq: true }, mnemonic: s.mnemonic } as any, pw);
writeFileSync('.demo/v15/noam-backup.json', JSON.stringify(sealed), { mode: 0o600 });
console.log('sealed backup for', s.account);
