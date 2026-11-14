// v15 capture helpers: CDP screencast (sharp 1920x1080 JPEG frames with real timestamps), a visible cursor, chapter marks.
import { mkdirSync, writeFileSync, utimesSync } from 'node:fs';
import { LOCK } from '/Volumes/Extreme SSD/Projects/grokbot/orchestration/chrome-lock.mjs';
export const V15 = '/Volumes/Extreme SSD/Projects/grokbot/projects/magen/videos/magen-near/versions/v15';
export const APP = 'http://localhost:5340/';
// Keep the shared Chrome lock fresh while a long take runs (it goes stale after 15 min of no mtime change).
export function keepLock() { const t = setInterval(() => { try { const n = new Date(); utimesSync(LOCK, n, n); } catch {} }, 60000); return () => clearInterval(t); }

const CURSOR = `(() => { const add = () => { if (document.getElementById('film-cursor')) return;
  const c = document.createElement('div'); c.id = 'film-cursor';
  c.style.cssText = 'position:fixed;left:-40px;top:-40px;width:22px;height:22px;z-index:2147483647;pointer-events:none;transition:left .55s cubic-bezier(.3,.7,.2,1),top .55s cubic-bezier(.3,.7,.2,1);';
  c.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24"><path d="M3 2l7.5 19 2.6-7.6L21 11z" fill="#fff" stroke="#111" stroke-width="1.6" stroke-linejoin="round"/></svg>';
  document.documentElement.appendChild(c);
  const r = document.createElement('div'); r.id = 'film-ripple';
  r.style.cssText = 'position:fixed;width:34px;height:34px;margin:-17px 0 0 -17px;border-radius:50%;border:2px solid rgba(255,255,255,.85);z-index:2147483646;pointer-events:none;opacity:0;transform:scale(.4);transition:transform .35s ease-out,opacity .45s ease-out;';
  document.documentElement.appendChild(r); };
  if (document.documentElement) add(); document.addEventListener('DOMContentLoaded', add);
  window.__filmCursor = (x, y) => { add(); const c = document.getElementById('film-cursor'); c.style.left = (x - 3) + 'px'; c.style.top = (y - 2) + 'px'; window.__fc = [x, y]; };
  window.__filmTap = (x, y) => { const r = document.getElementById('film-ripple'); r.style.transition = 'none'; r.style.left = x + 'px'; r.style.top = y + 'px'; r.style.opacity = '1'; r.style.transform = 'scale(.4)'; r.offsetWidth; r.style.transition = 'transform .35s ease-out,opacity .45s ease-out'; r.style.transform = 'scale(1.3)'; r.style.opacity = '0'; };
})();`;

export class Rec {
  constructor(page, name) { this.page = page; this.name = name; this.dir = `${V15}/raw/${name}`; this.frames = []; this.marks = []; this.n = 0; }
  async start() {
    mkdirSync(this.dir + '/f', { recursive: true });
    this.cdp = await this.page.context().newCDPSession(this.page);
    this.cdp.on('Page.screencastFrame', async f => {
      const file = `f/${String(this.n++).padStart(6, '0')}.jpg`;
      writeFileSync(`${this.dir}/${file}`, Buffer.from(f.data, 'base64'));
      this.frames.push({ file, t: f.metadata.timestamp });
      this.cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {});
    });
    await this.cdp.send('Page.startScreencast', { format: 'jpeg', quality: 90, maxWidth: 1920, maxHeight: 1080, everyNthFrame: 1 });
    this.t0 = Date.now() / 1000; this.mark('start');
  }
  mark(label, extra = {}) { const m = { label, t: Date.now() / 1000, ...extra }; this.marks.push(m); console.log(`[${this.name}] ${label}`, Object.keys(extra).length ? JSON.stringify(extra) : ''); this.save(); }
  save() { writeFileSync(`${this.dir}/rec.json`, JSON.stringify({ name: this.name, t0: this.t0, end: this.end, frames: this.frames, marks: this.marks }, null, 1)); }
  async stop() { await this.cdp.send('Page.stopScreencast').catch(() => {}); this.end = Date.now() / 1000; this.mark('end'); }
}
export async function setupPage(page) { await page.addInitScript(CURSOR); }
export async function moveTo(page, loc, opts = {}) {
  await loc.scrollIntoViewIfNeeded().catch(() => {});
  const b = await loc.boundingBox(); if (!b) throw Error('no box for cursor');
  const x = b.x + b.width * (opts.fx ?? 0.5), y = b.y + b.height * (opts.fy ?? 0.5);
  await page.evaluate(([x, y]) => window.__filmCursor?.(x, y), [x, y]); await page.waitForTimeout(650); return [x, y];
}
export async function click(page, loc, opts = {}) {
  const [x, y] = await moveTo(page, loc, opts); await page.waitForTimeout(opts.pause ?? 250);
  await page.evaluate(([x, y]) => window.__filmTap?.(x, y), [x, y]); await page.mouse.click(x, y); await page.waitForTimeout(opts.after ?? 400);
}
export async function type(page, loc, text, delay = 55) { await click(page, loc); await page.keyboard.type(text, { delay }); }
export async function smoothScroll(page, dy, ms = 1800) {
  await page.evaluate(([dy, ms]) => new Promise(res => { const s = window.scrollY, t0 = performance.now(); const el = document.scrollingElement;
    const f = t => { const k = Math.min(1, (t - t0) / ms), e = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2; window.scrollTo(0, s + dy * e); k < 1 ? requestAnimationFrame(f) : res(); }; requestAnimationFrame(f); }), [dy, ms]);
}
// Wait out FastNEAR rate-limit / loading states so a hold never films an error as normal. Returns ms waited.
export async function settle(page, rec, tag, max = 45000) {
  const t0 = Date.now();
  for (;;) {
    const bad = await page.evaluate(() => { const t = document.body.innerText; return /rate-limit|did not answer|Failed to fetch|Retrying/i.test(t) || /(^|\s)…(\s|$)/.test(document.querySelector('main')?.innerText ?? ''); }).catch(() => false);
    if (!bad || Date.now() - t0 > max) break; await page.waitForTimeout(1500);
  }
  if (rec) rec.mark(tag + '-settled', { waited: Date.now() - t0 }); return Date.now() - t0;
}
