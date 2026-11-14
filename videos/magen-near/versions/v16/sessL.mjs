// v16 landing take, 1920x1080: the hero plays from a fresh load, "Download for iPhone" opens the iPhone panel and the
// real zip downloads, then "Add to Chrome" shows the extension panel for two seconds.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { withChromeLock } from '/Volumes/Extreme SSD/Projects/grokbot/orchestration/chrome-lock.mjs';
import { Rec, setupPage, click, moveTo, APP, V15 as V16, keepLock } from './rec.mjs';
const DL = `${V16}/dl`; mkdirSync(DL, { recursive: true });
await withChromeLock(async () => {
  const stop = keepLock();
  const b = await chromium.launch({ headless: true });
  const ctx = await b.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1, acceptDownloads: true });
  const p = await ctx.newPage(); await setupPage(p);
  await p.goto('about:blank');
  const r = new Rec(p, 'L-landing'); await r.start();
  await p.goto(APP, { waitUntil: 'domcontentloaded' }); r.mark('load');
  await p.waitForTimeout(4200);
  await click(p, p.locator('a.w2-store[href="#iphone"]').first(), { after: 200 }); r.mark('iphone-panel');
  await p.waitForTimeout(1800);
  const dl = p.locator('.w2-get a.w2-get-dl').first();
  const [d] = await Promise.all([p.waitForEvent('download'), click(p, dl)]);
  await d.saveAs(`${DL}/Magen-NEAR-iOS-Simulator.zip`); r.mark('ios-downloaded');
  await p.waitForTimeout(1600);
  await p.keyboard.press('Escape'); await p.waitForTimeout(500);
  await click(p, p.locator('a.w2-store[href="#chrome"]').first(), { after: 200 }); r.mark('chrome-panel');
  await p.waitForTimeout(2600); r.mark('end-l');
  await r.stop(); await b.close(); stop();
});
