// Explorer-only takes: node sessX.mjs name=url[@scrollpx] ...  (screencast, 1600x900 viewport)
import { chromium } from 'playwright';
import { withChromeLock } from '/Volumes/Extreme SSD/Projects/grokbot/orchestration/chrome-lock.mjs';
import { Rec, V15 } from './rec.mjs';
const jobs = process.argv.slice(2).map(a => { const i = a.indexOf('='); const [url, sc] = a.slice(i + 1).split('@'); return { name: a.slice(0, i), url, scroll: Number(sc || 0) }; });
await withChromeLock(async () => {
  const b = await chromium.launch({ headless: true });
  const ctx = await b.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1.2, userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36' });
  for (const j of jobs) {
    const p = await ctx.newPage(); const r = new Rec(p, j.name); await r.start();
    await p.goto(j.url, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(e => r.mark('ERR', { m: e.message.slice(0, 120) }));
    await p.waitForTimeout(9000);
    if (j.scroll) { await p.mouse.move(800, 500); for (let i = 0; i < 10; i++) { await p.mouse.wheel(0, j.scroll / 10); await p.waitForTimeout(60); } await p.waitForTimeout(4000); }
    r.mark('title', { title: await p.title() }); await r.stop(); await p.close();
  }
  await b.close();
});
