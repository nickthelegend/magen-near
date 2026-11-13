// Private send, live on NEAR testnet: magen-ana.testnet pays a one-time account derived from the recipient's
// Magen meta-key (signed twice); the recipient opens the note, derives the one-time key and spends from it.
import { readFileSync, writeFileSync } from 'node:fs';
import { execute, makeIntent, nearAmount, outcome, query, signIntent, view } from '../sdk/index.ts';
import { metaKey, newStealthPayment, openStealthNote, sweep } from '../sdk/stealth.ts';
const sender = JSON.parse(readFileSync('.demo/guardians-live.json', 'utf8'));
const recipient = JSON.parse(readFileSync('.demo/vault.json', 'utf8')); // shield.magen-mwf26bd5.testnet
const live = JSON.parse(readFileSync('.demo/live.json', 'utf8'));
const meta = metaKey(recipient.keys);
const pay = newStealthPayment(meta);
const s = await view(sender.account);
const r = await execute({ account: sender.account, seed: sender.newKeys.ed }, sender.account, signIntent(makeIntent(sender.account, s.nonce, { kind: 'send', receiver: pay.account, amount: nearAmount('0.1') }), sender.newKeys));
console.log('private send', r.hash, r.success, r.error.slice(0, 100));
for (let i = 0; i < 20 && !(await query('view_account', pay.account).then(() => true, () => false)); i++) await new Promise(x => setTimeout(x, 1500));
const opened = openStealthNote(recipient.keys, pay.note);
if (opened.account !== pay.account) throw Error('recipient derived a different account');
const bal = (await query('view_account', opened.account)).amount;
const sw = await sweep(opened, `tips.${live.relay.account}`);
const swOk = sw.status && 'SuccessValue' in sw.status;
console.log('recipient spends from one-time account', sw.transaction.hash, swOk);
writeFileSync('deployments/private-live.json', JSON.stringify({
  network: 'testnet', sender: sender.account, recipient_main: recipient.wallet, recipient_meta_key: meta,
  one_time_account: pay.account, note_published_to_recipient_only: pay.note.slice(0, 16) + '…',
  send_signed_twice: { hash: r.hash, success: r.success, amount: '0.1 NEAR' }, one_time_balance_seen_by_recipient: bal,
  recipient_spends_from_one_time_account: { hash: sw.transaction.hash, success: !!swOk, to: `tips.${live.relay.account}` },
  hidden: 'link between the payment and the recipient main account', not_hidden: ['sender account', 'amount', 'timing'],
}, null, 2));
