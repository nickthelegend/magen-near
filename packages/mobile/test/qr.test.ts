// The custom QR must stay scannable: rasterise the exact SVG the app draws (resvg), then decode it with jsQR.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';
import jsQR from 'jsqr';
import { PNG } from 'pngjs';
import { magenQr } from '../src/qr.ts';
import { receiveCode, parseScan } from '../src/scan.ts';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '../build-out/qr-test');

function decode(svg: string, width: number, name: string) {
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: width }, background: '#ffffff' }).render().asPng();
  mkdirSync(OUT, { recursive: true }); writeFileSync(join(OUT, name), png);
  const img = PNG.sync.read(png);
  return jsQR(new Uint8ClampedArray(img.data.buffer, img.data.byteOffset, img.data.length), img.width, img.height);
}

const cases: [string, string][] = [
  ['named account', receiveCode('magen-maya.testnet')],
  ['sub-account', receiveCode('shield.magen-mwf26bd5.testnet')],
  ['implicit account', receiveCode('a'.repeat(16) + '0123456789abcdef'.repeat(3))],
  ['pay request', receiveCode('magen-maya.testnet', '1.25', 'Coffee at Noor ☕')],
  ['long pay request', receiveCode('shield.magen-film-mwf2kq5t.testnet', '0.000000000000000000000001', 'x'.repeat(140))],
];

for (const [label, value] of cases) {
  test(`QR round-trip: ${label}`, () => {
    const q = magenQr(value);
    assert.ok(q.logo >= 5, 'centre shield is drawn');
    for (const w of [240, 480]) {
      const r = decode(q.svg, w, `${label.replace(/\W+/g, '-')}-${w}.png`);
      assert.ok(r, `jsQR found the code at ${w}px (version ${q.version})`);
      assert.equal(r!.data, value);
    }
  });
}

test('decoded pay request parses back to the same fields', () => {
  const value = receiveCode('magen-maya.testnet', '1.25', 'Coffee at Noor');
  const r = decode(magenQr(value).svg, 360, 'pay-parse.png');
  assert.deepEqual(parseScan(r!.data, 'someone-else.testnet'), { kind: 'pay', to: 'magen-maya.testnet', amount: '1.25', memo: 'Coffee at Noor', via: 'magen' });
});
