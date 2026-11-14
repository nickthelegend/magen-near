import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { HDKey } from '@scure/bip32';
import { derivePath } from 'ed25519-hd-key';
import nacl from 'tweetnacl';
import { parseSeedPhrase } from 'near-seed-phrase';
import bs58check from 'bs58check';
import { bech32 as refBech32 } from 'bech32';
import { base58, base64 } from '@scure/base';
import {
  PATHS, bitcoinAddress, cosmosAddress, deriveAll, dogecoinAddress, ethAddress, litecoinAddress, magenKeysFromMnemonic,
  mnemonicSeed, nearKey, newMnemonic, pqSeed, slip10Ed25519, solanaAddress, validMnemonic, zcashAddress,
} from './hd.ts';
import { makeIntent, ml_dsa65, publicKeys, signIntent, verifyIntent } from './index.ts';

const M = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const hexOf = (b: Uint8Array) => Buffer.from(b).toString('hex');
// Independent hash160 + encoders (node:crypto, bs58check, bech32 npm), fed the same BIP-32 pubkey.
const refHash160 = (pub: Uint8Array) => createHash('ripemd160').update(createHash('sha256').update(pub).digest()).digest();
const pubAt = (path: string) => HDKey.fromMasterSeed(mnemonicSeed(M)).derive(path).publicKey!;

test('BIP-39: new phrase is 12 valid words, bad checksum and unknown words are rejected', () => {
  const m = newMnemonic();
  assert.equal(m.split(' ').length, 12);
  assert.ok(validMnemonic(m));
  assert.ok(validMnemonic('  ' + M.toUpperCase() + ' '), 'whitespace and case are normalised');
  assert.equal(validMnemonic('abandon '.repeat(12).trim()), false, 'checksum must fail');
  assert.equal(validMnemonic(M.replace('about', 'aboutt')), false);
  assert.throws(() => mnemonicSeed('abandon '.repeat(12).trim()), /Invalid recovery phrase/);
  assert.throws(() => deriveAll('not a phrase'), /Invalid recovery phrase/);
  assert.throws(() => magenKeysFromMnemonic('abandon '.repeat(12).trim()), /Invalid recovery phrase/);
  // BIP-39 reference vector (trezor/python-mnemonic vectors.json uses passphrase "TREZOR"; with "" the seed is:)
  assert.equal(hexOf(mnemonicSeed(M)), '5eb00bbddcf069084889a8ab9155568165f5c453ccb85e70811aaed6f6da5fc19a5ac40b389cd370d086206dec8aa6c43daea6690f20ad3d8d48b2d2ce9e38e4');
});

test('Ethereum m/44\'/60\'/0\'/0/0 vector, EIP-55 checksummed', () => {
  assert.equal(ethAddress(M), '0x9858EfFD232B4033E47d90003D41EC34EcaEda94');
});

test('Bitcoin BIP-84 vectors: testnet tb1 and mainnet bc1', () => {
  assert.equal(bitcoinAddress(M), 'tb1q6rz28mcfaxtmd6v789l9rrlrusdprr9pqcpvkl');
  assert.equal(bitcoinAddress(M, { mainnet: true }), 'bc1qcr8te4kr609gcawutmrza0j4xv80jy8z306fyu');
});

test('Cosmos Hub m/44\'/118\'/0\'/0/0 vector', () => {
  assert.equal(cosmosAddress(M), 'cosmos19rl4cm2hmr8afy4kldpxz3fka4jguq0auqdal4');
});

test('SLIP-10 ed25519 spec test vector 1 (master and m/0\'/1\'/2\'/2\'/1000000000\')', () => {
  const seed = Uint8Array.from(Buffer.from('000102030405060708090a0b0c0d0e0f', 'hex'));
  assert.equal(hexOf(slip10Ed25519(seed, 'm')), '2b4be7f19ee27bbf30c667b642d5f4aa69fd169872f8fc3059c08ebae2eb19e7');
  assert.equal(hexOf(slip10Ed25519(seed, "m/0'")), '68e0fe46dfb67e368c75379acec591dad19df3cde26e63b93a8e704f1dade7a3');
  assert.equal(hexOf(slip10Ed25519(seed, "m/0'/1'/2'/2'/1000000000'")), '8f94d394a8e8fd6b1bc2f3f49f5c47e385281d5c17e65324b0f62483e37e8793');
  assert.throws(() => slip10Ed25519(seed, 'm/0'), /hardened/);
});

test('Solana m/44\'/501\'/0\'/0\': Phantom vector and ed25519-hd-key + tweetnacl agree', () => {
  assert.equal(solanaAddress(M), 'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk');
  const ref = derivePath(PATHS.solana, hexOf(mnemonicSeed(M))).key;
  assert.equal(base58.encode(nacl.sign.keyPair.fromSeed(ref).publicKey), solanaAddress(M));
});

test('NEAR m/44\'/397\'/0\': matches near-seed-phrase parseSeedPhrase, implicit id = hex pubkey', () => {
  const ref = parseSeedPhrase(M);
  const n = nearKey(M);
  assert.equal(n.publicKey, ref.publicKey);
  assert.equal(n.implicit, hexOf(base58.decode(ref.publicKey.slice(8))));
  assert.match(n.implicit, /^[0-9a-f]{64}$/);
  // near-seed-phrase's secretKey is the 64-byte ed25519 secret (seed || pub): its first 32 bytes are our seed.
  assert.equal(hexOf(base58.decode(ref.secretKey.slice(8)).slice(0, 32)), hexOf(n.seed));
});

test('Zcash t-addr, Litecoin tltc1 and Dogecoin testnet match independent encoders', () => {
  const zpub = pubAt(PATHS.zcash);
  assert.equal(zcashAddress(M), bs58check.encode(Buffer.concat([Buffer.from([0x1d, 0x25]), refHash160(zpub)])));
  assert.match(zcashAddress(M), /^tm[1-9A-HJ-NP-Za-km-z]{33}$/);
  const lpub = pubAt(PATHS.litecoin);
  assert.equal(litecoinAddress(M), refBech32.encode('tltc', [0, ...refBech32.toWords(refHash160(lpub))]));
  assert.ok(litecoinAddress(M).startsWith('tltc1q'));
  assert.equal(dogecoinAddress(M), bs58check.encode(Buffer.concat([Buffer.from([0x71]), refHash160(pubAt(PATHS.dogecoin))])));
  assert.match(dogecoinAddress(M), /^n/);
});

test('ML-DSA-65 key from the same seed: deterministic, phrase-bound, fee key separate', () => {
  const a = magenKeysFromMnemonic(M), b = magenKeysFromMnemonic(M), other = magenKeysFromMnemonic(newMnemonic());
  const pkA = ml_dsa65.keygen(base64.decode(a.keys.pq)).publicKey;
  assert.equal(hexOf(pkA), hexOf(ml_dsa65.keygen(base64.decode(b.keys.pq)).publicKey));
  assert.notEqual(hexOf(pkA), hexOf(ml_dsa65.keygen(base64.decode(other.keys.pq)).publicKey));
  assert.notEqual(a.keys.pq, a.feeSeed, 'fee key uses its own HKDF label');
  assert.notEqual(other.feeSeed, a.feeSeed);
  assert.equal(base64.decode(a.keys.pq).length, 32);
  assert.equal(base64.decode(a.feeSeed).length, 32);
  assert.equal(a.keys.pq, base64.encode(pqSeed(M)));
  // Keys.ed is the NEAR SLIP-10 seed, so the hybrid intent signer works with phrase-derived keys.
  assert.equal(a.near.publicKey, 'ed25519:' + base58.encode(publicKeys(a.keys).ed));
  const signed = signIntent(makeIntent(a.near.implicit, '1', { kind: 'send', receiver: 'bob.testnet', amount: '1' }), a.keys);
  assert.ok(verifyIntent(signed, publicKeys(a.keys)));
  assert.equal(verifyIntent(signed, publicKeys(other.keys)), false);
});

test('deriveAll lists every chain once with explorer links and the ML-DSA handle', () => {
  const d = deriveAll(M), again = deriveAll(M);
  const ids = d.chains.map(c => c.id);
  assert.deepEqual(ids, ['near', 'bitcoin', 'ethereum', 'base', 'arbitrum', 'avalanche', 'solana', 'cosmos', 'zcash', 'litecoin', 'dogecoin']);
  for (const c of d.chains) {
    assert.ok(c.address && c.explorer(c.address).startsWith('https://') && c.explorer(c.address).includes(c.address), c.id);
    assert.ok(c.scheme === 'secp256k1' || c.scheme === 'ed25519');
  }
  assert.equal(new Set(d.chains.filter(c => c.path === PATHS.ethereum).map(c => c.address)).size, 1, 'one EVM address');
  assert.match(d.pqHandle, /^ml-dsa-65-hash:[1-9A-HJ-NP-Za-km-z]+$/);
  assert.equal(d.pqHandle, again.pqHandle);
  assert.notEqual(d.pqHandle, d.feePqHandle);
  assert.notEqual(d.pqHandle, deriveAll(newMnemonic()).pqHandle);
});
