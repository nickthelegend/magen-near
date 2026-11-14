import { test } from 'node:test';
import assert from 'node:assert/strict';
import { secp256k1 } from '@noble/curves/secp256k1.js';
import { keccak_256 } from '@noble/hashes/sha3.js';
import nacl from 'tweetnacl';
import { base58 } from '@scure/base';
import { deriveAll, ethKey, solanaKey } from './hd.ts';
import { balanceOf, compactU16, rlp, signEip1559, solanaTransferMessage } from './multichain.ts';

const M = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const hex = (b: Uint8Array) => Buffer.from(b).toString('hex');

test('compact-u16 matches the Solana wire format', () => {
  assert.deepEqual([...compactU16(0)], [0]);
  assert.deepEqual([...compactU16(0x7f)], [0x7f]);
  assert.deepEqual([...compactU16(0x80)], [0x80, 0x01]);
  assert.deepEqual([...compactU16(0x3fff)], [0xff, 0x7f]);
  assert.deepEqual([...compactU16(0x4000)], [0x80, 0x80, 0x01]);
  assert.deepEqual([...compactU16(0xffff)], [0xff, 0xff, 0x03]);
  assert.throws(() => compactU16(0x10000));
});

test('Solana transfer message layout and signature verify with tweetnacl', () => {
  const k = solanaKey(M), to = new Uint8Array(32).fill(7), bh = base58.encode(new Uint8Array(32).fill(9));
  const msg = solanaTransferMessage(k.publicKey, to, 10_000_000n, bh);
  assert.deepEqual([...msg.slice(0, 4)], [1, 0, 1, 3]);
  assert.equal(hex(msg.slice(4, 36)), hex(k.publicKey));
  assert.equal(hex(msg.slice(68, 100)), hex(new Uint8Array(32)), 'System Program id');
  assert.equal(msg.length, 3 + 1 + 96 + 32 + 1 + 1 + 1 + 2 + 1 + 12);
  const data = msg.slice(-12);
  assert.deepEqual([...data.slice(0, 4)], [2, 0, 0, 0]);
  assert.equal(new DataView(data.buffer, data.byteOffset).getBigUint64(4, true), 10_000_000n);
  const sig = nacl.sign.detached(msg, nacl.sign.keyPair.fromSeed(k.secret).secretKey);
  assert.ok(nacl.sign.detached.verify(msg, sig, k.publicKey));
});

test('RLP canonical encodings', () => {
  assert.equal(hex(rlp(0n)), '80');
  assert.equal(hex(rlp(15n)), '0f');
  assert.equal(hex(rlp(1024n)), '820400');
  assert.equal(hex(rlp([])), 'c0');
  assert.equal(hex(rlp(new TextEncoder().encode('dog'))), '83646f67');
  assert.equal(hex(rlp(new Uint8Array(56))).slice(0, 4), 'b838');
});

test('EIP-1559 signature recovers to the derived address', () => {
  const k = ethKey(M);
  const t = { chainId: 11155111n, nonce: 3n, maxPriorityFeePerGas: 1_000_000_000n, maxFeePerGas: 30_000_000_000n, gas: 21000n, to: '0x' + '11'.repeat(20), value: 10n ** 15n };
  const s = signEip1559(t, k.privateKey);
  assert.match(s.raw, /^0x02f8/);
  assert.equal(s.hash, '0x' + hex(keccak_256(Buffer.from(s.raw.slice(2), 'hex'))));
  // Pull y-parity, r, s back out of the tail and recover the signer.
  const raw = Buffer.from(s.raw.slice(2), 'hex'), tail = raw.subarray(raw.length - 67);
  assert.ok((tail[0] === 0x80 || tail[0] === 0x01) && tail[1] === 0xa0 && tail[34] === 0xa0, 'y-parity then 32-byte r and s');
  const parity = tail[0] === 0x80 ? 0 : 1;
  const unsigned = rlp([t.chainId, t.nonce, t.maxPriorityFeePerGas, t.maxFeePerGas, t.gas, Buffer.from('11'.repeat(20), 'hex'), t.value, new Uint8Array(), []]);
  const h = keccak_256(Buffer.concat([Buffer.from([2]), unsigned]));
  const sig = new secp256k1.Signature(BigInt('0x' + hex(tail.subarray(2, 34))), BigInt('0x' + hex(tail.subarray(35, 67)))).addRecoveryBit(parity);
  const pub = sig.recoverPublicKey(h).toBytes(false);
  assert.equal('0x' + hex(keccak_256(pub.slice(1)).slice(12)), k.address.toLowerCase());
  assert.throws(() => signEip1559({ ...t, to: '0x12' }, k.privateKey), /40 hex/);
});

// Live: every chain's real public endpoint. Run with MAGEN_LIVE=1 (CI stays offline).
test('live balances from public testnet endpoints', { skip: !process.env.MAGEN_LIVE }, async () => {
  for (const c of deriveAll(M).chains) {
    const b = await balanceOf(c.id, c.address);
    if ('unsupported' in b) { assert.ok(c.id === 'zcash' || c.id === 'dogecoin'); console.log(`  ${c.id}: unsupported (${b.unsupported})`); continue; }
    assert.match(b.amount, /^\d+$/);
    console.log(`  ${c.id}: ${b.amount} (10^-${b.decimals} ${b.symbol})`);
  }
});
