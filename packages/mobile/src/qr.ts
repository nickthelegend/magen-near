// Magen's custom QR: lattice-dot modules joined by faint lattice bonds, rounded finder and alignment eyes, a
// navy-to-blue gradient and the lattice shield in the centre. Error correction H, so the shield (≈6 % of the
// modules) costs nothing to scanners. It returns plain SVG markup: the app draws it with react-native-svg's
// SvgXml, and test/qr.test.ts rasterises the very same string and decodes it back.
import QR from 'qrcode/lib/core/qrcode.js';
import Align from 'qrcode/lib/core/alignment-pattern.js';

const QUIET = 3;
const f = (n: number) => +n.toFixed(3);
const rr = (x: number, y: number, w: number, h: number, r: number) =>
  `M${f(x + r)} ${f(y)}H${f(x + w - r)}A${r} ${r} 0 0 1 ${f(x + w)} ${f(y + r)}V${f(y + h - r)}A${r} ${r} 0 0 1 ${f(x + w - r)} ${f(y + h)}H${f(x + r)}A${r} ${r} 0 0 1 ${f(x)} ${f(y + h - r)}V${f(y + r)}A${r} ${r} 0 0 1 ${f(x + r)} ${f(y)}Z`;
const dot = (cx: number, cy: number, r: number) => `M${f(cx - r)} ${f(cy)}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z`;

export type QrInfo = { svg: string; version: number; modules: number; logo: number };

/** SVG for `value`. `px` only sets width/height; geometry is in module units. */
export function magenQr(value: string, px = 240): QrInfo {
  const q = QR.create(value, { errorCorrectionLevel: 'H' });
  const n: number = q.modules.size; const data: Uint8Array = q.modules.data;
  const dark = (r: number, c: number) => r >= 0 && c >= 0 && r < n && c < n && !!data[r * n + c];
  const eyes: [number, number][] = [[0, 0], [0, n - 7], [n - 7, 0]];
  const inEye = (r: number, c: number) => eyes.some(([er, ec]) => r >= er && r < er + 7 && c >= ec && c < ec + 7);
  const aligns: [number, number][] = (Align.getPositions(q.version) as [number, number][]).filter(([r, c]) => !inEye(r, c) && !inEye(r + 4, c + 4) && !inEye(r - 2, c - 2));
  const inAlign = (r: number, c: number) => aligns.some(([ar, ac]) => r >= ar - 2 && r <= ar + 2 && c >= ac - 2 && c <= ac + 2);
  let logo = Math.round(n * 0.24); if (logo % 2 === 0) logo += 1;
  const l0 = (n - logo) / 2;
  const inLogo = (r: number, c: number) => r >= l0 && r < l0 + logo && c >= l0 && c < l0 + logo;
  const free = (r: number, c: number) => dark(r, c) && !inEye(r, c) && !inAlign(r, c) && !inLogo(r, c);

  const V = n + QUIET * 2; const o = QUIET;
  let dots = '', bonds = '';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    if (!free(r, c)) continue;
    const cx = o + c + 0.5, cy = o + r + 0.5;
    dots += dot(cx, cy, 0.4);
    if (free(r, c + 1)) bonds += `M${f(cx)} ${f(cy - 0.13)}h1v0.26h-1Z`;
    if (free(r + 1, c)) bonds += `M${f(cx - 0.13)} ${f(cy)}h0.26v1h-0.26Z`;
  }
  let eyePath = '';
  for (const [er, ec] of eyes) {
    const x = o + ec, y = o + er;
    eyePath += rr(x, y, 7, 7, 2.1) + rr(x + 1, y + 1, 5, 5, 1.4) + rr(x + 2, y + 2, 3, 3, 0.9);
  }
  for (const [ar, ac] of aligns) {
    const x = o + ac - 2, y = o + ar - 2;
    eyePath += rr(x, y, 5, 5, 1.5) + rr(x + 1, y + 1, 3, 3, 0.9) + dot(x + 2.5, y + 2.5, 0.6);
  }
  const lx = o + l0, inset = 0.55, s = logo - inset * 2, k = s / 32;
  const shield = `<g transform="translate(${f(lx + inset)} ${f(lx + inset)}) scale(${f(k)})" fill="none" stroke="#fff" stroke-linejoin="round" stroke-linecap="round">`
    + `<path d="M16 5 25 8.4v6.9c0 5.7-3.8 10.1-9 12.4-5.2-2.3-9-6.7-9-12.4V8.4L16 5Z" stroke-width="1.9"/>`
    + `<path d="M11.5 10.5v10M16 9v14.5M20.5 10.5v10M9.5 13.8h13M9.5 18.2h13" stroke-width="1.1" stroke-opacity=".55"/>`
    + `<circle cx="16" cy="16" r="1.7" fill="#fff" stroke="none"/></g>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}" viewBox="0 0 ${V} ${V}">`
    + `<defs><linearGradient id="mq" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="${V}" y2="${V}">`
    + `<stop offset="0" stop-color="#0B0C0F"/><stop offset="0.5" stop-color="#4A1442"/><stop offset="1" stop-color="#8E1E7D"/></linearGradient>`
    + `<linearGradient id="ms" gradientUnits="userSpaceOnUse" x1="${lx}" y1="${lx}" x2="${lx + logo}" y2="${lx + logo}">`
    + `<stop offset="0" stop-color="#EE6AD9"/><stop offset="1" stop-color="#B02A9B"/></linearGradient></defs>`
    + `<rect width="${V}" height="${V}" fill="#ffffff"/>`
    + `<path d="${bonds}" fill="url(#mq)" fill-opacity="0.55"/>`
    + `<path d="${dots}" fill="url(#mq)"/>`
    + `<path d="${eyePath}" fill="url(#mq)" fill-rule="evenodd"/>`
    + `<path d="${rr(lx + inset, lx + inset, s, s, s * 0.28)}" fill="url(#ms)"/>`
    + shield + `</svg>`;
  return { svg, version: q.version, modules: n, logo };
}
