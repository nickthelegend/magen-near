// v17 landing take, 1920x1080: the hero states the quantum risk, a smooth scroll to the "Four chains, one weakness"
// section, back up to the store buttons, the iPhone panel, then the Chrome extension panel for about two seconds.
import { chromium } from 'playwright';
import { withChromeLock } from '/Volumes/Extreme SSD/Projects/grokbot/orchestration/chrome-lock.mjs';
import { Rec, setupPage, click, smoothScroll, APP, keepLock } from './rec.mjs';
await withChromeLock(async () => {
  const stop = keepLock();
  const b = await chromium.launch({ headless: true });
  const ctx = await b.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const p = await ctx.newPage(); await setupPage(p);
  await p.goto('about:blank');
  const r = new Rec(p, 'L-landing'); await r.start();
  await p.goto(APP, { waitUntil: 'domcontentloaded' }); r.mark('load');
  await p.waitForTimeout(5200);
  const y = await p.evaluate(() => document.getElementById('risk').getBoundingClientRect().top + scrollY - 40);
  await smoothScroll(p, y, 1600); r.mark('risk');
  await p.waitForTimeout(6200);
  await smoothScroll(p, -y, 1200); r.mark('top');
  await p.waitForTimeout(400);
  await click(p, p.locator('a.w2-store[href="#iphone"]').first(), { after: 200 }); r.mark('iphone-panel');
  await p.waitForTimeout(1700);
  await p.keyboard.press('Escape'); await p.waitForTimeout(400);
  await click(p, p.locator('a.w2-store[href="#chrome"]').first(), { after: 200 }); r.mark('chrome-panel');
  await p.waitForTimeout(2700); r.mark('end-l');
  await r.stop(); await b.close(); stop();
});
