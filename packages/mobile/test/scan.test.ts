// Every kind of code the Scan screen and magen:// links can receive, plus bad input.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseScan, receiveCode, payLink, checkAccount, checkAmount } from '../src/scan.ts';

const ME = 'magen-maya.testnet';
const IMPLICIT = '98793cd91a3f870fb126f66285808c7e094afcfc4eda8a970f6648cdf0dbd6de';

test('named, sub- and upper-case accounts route to Send', () => {
  assert.deepEqual(parseScan('bob.testnet', ME), { kind: 'account', account: 'bob.testnet' });
  assert.deepEqual(parseScan('  shield.magen-mwf26bd5.testnet\n', ME), { kind: 'account', account: 'shield.magen-mwf26bd5.testnet' });
  assert.deepEqual(parseScan('Bob_1.Testnet', ME), { kind: 'account', account: 'bob_1.testnet' });
});

test('implicit and eth-implicit accounts route to Send', () => {
  assert.deepEqual(parseScan(IMPLICIT, ME), { kind: 'account', account: IMPLICIT });
  assert.deepEqual(parseScan(IMPLICIT.toUpperCase(), ME), { kind: 'account', account: IMPLICIT });
  assert.deepEqual(parseScan('0x' + 'ab'.repeat(20), ME), { kind: 'account', account: '0x' + 'ab'.repeat(20) });
});

test('magen://pay requests (with and without amount and memo)', () => {
  assert.deepEqual(parseScan('magen://pay?to=bob.testnet&amount=1.5&memo=Coffee%20%E2%98%95', ME), { kind: 'pay', to: 'bob.testnet', amount: '1.5', memo: 'Coffee ☕', via: 'magen' });
  assert.deepEqual(parseScan('magen://pay?to=bob.testnet', ME), { kind: 'pay', to: 'bob.testnet', via: 'magen' });
  assert.deepEqual(parseScan('magen:pay?to=bob.testnet&amount=0.000000000000000000000001', ME), { kind: 'pay', to: 'bob.testnet', amount: '0.000000000000000000000001', via: 'magen' });
  assert.deepEqual(parseScan('MAGEN://pay?amount=2&to=Bob.testnet&extra=1', ME), { kind: 'pay', to: 'bob.testnet', amount: '2', via: 'magen' });
});

test('https pay links on the Magen site (hash route and path)', () => {
  assert.deepEqual(parseScan('https://magen-near.vercel.app/#/pay?to=bob.testnet&amount=3', ME), { kind: 'pay', to: 'bob.testnet', amount: '3', via: 'https' });
  assert.deepEqual(parseScan('https://magen-near.vercel.app/pay?to=bob.testnet&memo=hi+there', ME), { kind: 'pay', to: 'bob.testnet', memo: 'hi there', via: 'https' });
  assert.equal((parseScan('https://magen-near.vercel.app/#/app', ME) as any).code, 'unknown-link');
});

test('builders produce codes the parser reads back', () => {
  assert.equal(receiveCode('bob.testnet'), 'bob.testnet');
  assert.equal(receiveCode('bob.testnet', '1.25', 'a&b=c'), 'magen://pay?to=bob.testnet&amount=1.25&memo=a%26b%3Dc');
  assert.deepEqual(parseScan(receiveCode('bob.testnet', '1.25', 'a&b=c'), ME), { kind: 'pay', to: 'bob.testnet', amount: '1.25', memo: 'a&b=c', via: 'magen' });
  assert.deepEqual(parseScan(payLink('bob.testnet', '7'), ME), { kind: 'pay', to: 'bob.testnet', amount: '7', via: 'https' });
  assert.deepEqual(parseScan(payLink('bob.testnet'), ME), { kind: 'pay', to: 'bob.testnet', via: 'https' });
});

test('magen:// screen links (deep links)', () => {
  assert.deepEqual(parseScan('magen://receive'), { kind: 'open', screen: 'code' });
  assert.deepEqual(parseScan('magen://scan'), { kind: 'open', screen: 'scan' });
  assert.deepEqual(parseScan('magen://send'), { kind: 'open', screen: 'send' });
  assert.deepEqual(parseScan('magen://send?to=bob.testnet&amount=0.5', ME), { kind: 'open', screen: 'send', to: 'bob.testnet', amount: '0.5' });
  assert.equal((parseScan('magen://settings') as any).code, 'unknown-link');
});

test('dApp and WalletConnect requests get a clear "not on the phone yet" error', () => {
  for (const s of ['wc:8a5e5bdc-a0e4-4702-ba63-8f1a5655744f@2?relay-protocol=irn&symKey=abc',
    'https://testnet.mynearwallet.com/sign?transactions=AAAA&callbackUrl=https%3A%2F%2Fdapp.example',
    'https://wallet.testnet.near.org/login/?success_url=https%3A%2F%2Fdapp.example',
    'near:bob.testnet?amount=1']) {
    const r = parseScan(s, ME) as any;
    assert.equal(r.kind, 'error', s); assert.equal(r.code, 'dapp', s); assert.match(r.message, /Chrome extension/);
  }
});

test('own code, mainnet and malformed accounts are refused with a reason', () => {
  assert.equal((parseScan(ME, ME) as any).code, 'self');
  assert.equal((parseScan(`magen://pay?to=${ME}&amount=1`, ME) as any).code, 'self');
  assert.equal((parseScan('alice.near', ME) as any).code, 'mainnet');
  assert.equal((parseScan('magen://pay?to=alice.near', ME) as any).code, 'mainnet');
  for (const s of ['bob', 'testnet', 'bob..testnet', '-bob.testnet', 'bob-.testnet', 'a'.repeat(60) + '.testnet', 'bob@testnet', 'b.testnet.']) {
    const r = parseScan(s, ME) as any; assert.equal(r.kind, 'error', s); assert.equal(r.code, 'bad-account', s);
  }
  assert.equal((parseScan('ab'.repeat(31) + 'zz', ME) as any).code, 'bad-account'); // 64 chars, not hex
});

test('bad pay requests: missing recipient, bad or zero amounts', () => {
  assert.equal((parseScan('magen://pay?amount=1', ME) as any).code, 'missing-to');
  assert.equal((parseScan('magen://pay?to=', ME) as any).code, 'missing-to');
  for (const a of ['0', '0.0', '-1', '1e3', '1.', '.5', '01', '1,5', 'abc', '1.' + '1'.repeat(25)]) {
    const r = parseScan(`magen://pay?to=bob.testnet&amount=${encodeURIComponent(a)}`, ME) as any;
    assert.equal(r.code, 'bad-amount', a);
  }
});

test('memo is trimmed, stripped of control characters and capped at 140', () => {
  const r = parseScan(`magen://pay?to=bob.testnet&memo=${encodeURIComponent('  hi\u0000\nthere ' + 'x'.repeat(300))}`, ME) as any;
  assert.equal(r.kind, 'pay'); assert.equal(r.memo.length, 140); assert.ok(r.memo.startsWith('hi  there'));
  assert.equal((parseScan('magen://pay?to=bob.testnet&memo=%E0%A4%A', ME) as any).kind, 'pay'); // broken escape kept as text
});

test('empty, oversized, random text and other links', () => {
  assert.equal((parseScan('', ME) as any).code, 'empty');
  assert.equal((parseScan('   ', ME) as any).code, 'empty');
  assert.equal((parseScan('x'.repeat(3000), ME) as any).code, 'too-long');
  assert.equal((parseScan('hello world', ME) as any).code, 'unknown');
  assert.equal((parseScan('https://example.com/pay?to=bob.testnet', ME) as any).code, 'unknown');
  assert.equal((parseScan('ed25519:5Hbq3H5pPZ', ME) as any).code, 'unknown');
  assert.equal((parseScan('bitcoin:bc1qxyz?amount=1', ME) as any).code, 'unknown');
});

test('checkAccount / checkAmount edges', () => {
  assert.deepEqual(checkAccount('ab.testnet'), { ok: true, account: 'ab.testnet' });
  assert.equal(checkAmount('10'), '10'); assert.equal(checkAmount('0.5'), '0.5');
  assert.equal(checkAmount('0.000'), null); assert.equal(checkAmount(''), null);
});
