// Landing (fresh load, hero plays, slow scroll with reveals) -> download both builds from the landing -> load the
// downloaded Chrome extension and open it. Downloads land in v15/dl (gitignored media folder).
import { chromium } from 'playwright';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { withChromeLock } from '/Volumes/Extreme SSD/Projects/grokbot/orchestration/chrome-lock.mjs';
import { Rec, setupPage, click, moveTo, APP, V15, keepLock, smoothScroll } from './rec.mjs';
const part = process.argv[2] || 'landing,ext';
const DL = `${V15}/dl`; mkdirSync(DL, { recursive: true });
await withChromeLock(async () => {
  const stop = keepLock();
  if (part.includes('landing')) {
    const b = await chromium.launch({ headless: true });
    const ctx = await b.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1.2, acceptDownloads: true });
    const p = await ctx.newPage(); await setupPage(p);
    await p.goto('about:blank');
    const r = new Rec(p, 'L-landing'); await r.start();
    await p.goto(APP, { waitUntil: 'domcontentloaded' }); r.mark('load');
    await p.waitForTimeout(3200); r.mark('scroll');
    const H = await p.evaluate(() => document.documentElement.scrollHeight);
    const target = await p.evaluate(() => document.getElementById('download').getBoundingClientRect().top + scrollY - 90);
    // slow continuous scroll in steps so each section's reveal plays
    const steps = 9; const per = target / steps;
    for (let i = 0; i < steps; i++) { await smoothScroll(p, per, 1300); await p.waitForTimeout(350); }
    r.mark('download-section', { H, target }); await p.waitForTimeout(1200);
    const ext = p.locator('a[href="/downloads/magen-extension.zip"]').first();
    const [d1] = await Promise.all([p.waitForEvent('download'), click(p, ext)]);
    await d1.saveAs(`${DL}/magen-extension.zip`); r.mark('ext-downloaded');
    await p.waitForTimeout(1200);
    const ios = p.locator('a[href="/downloads/Magen-NEAR-iOS-Simulator.zip"]').first();
    const [d2] = await Promise.all([p.waitForEvent('download'), click(p, ios)]);
    await d2.saveAs(`${DL}/Magen-NEAR-iOS-Simulator.zip`); r.mark('ios-downloaded');
    await p.waitForTimeout(1800); await r.stop(); await b.close();
  }
  if (part.includes('ext')) {
    const dir = `${DL}/magen-extension`; rmSync(dir, { recursive: true, force: true }); mkdirSync(dir);
    execFileSync('unzip', ['-q', `${DL}/magen-extension.zip`, '-d', dir]);
    const user = `${DL}/chrome-profile`; rmSync(user, { recursive: true, force: true });
    const ctx = await chromium.launchPersistentContext(user, { channel: 'chromium', headless: true, viewport: { width: 1600, height: 900 }, deviceScaleFactor: 2,
      args: [`--disable-extensions-except=${dir}`, `--load-extension=${dir}`] });
    let sw = ctx.serviceWorkers()[0] ?? await ctx.waitForEvent('serviceworker', { timeout: 20000 });
    const id = sw.url().split('/')[2]; writeFileSync(`${V15}/raw/E-id.txt`, id);
    const p = ctx.pages()[0] ?? await ctx.newPage(); await setupPage(p);
    await p.goto('chrome://extensions/');
    const r = new Rec(p, 'E-ext'); await r.start(); await p.waitForTimeout(1500);
    // turn on developer mode so the unpacked extension's details show
    await p.evaluate(() => { const t = document.querySelector('extensions-manager')?.shadowRoot?.querySelector('extensions-toolbar')?.shadowRoot?.querySelector('#devMode'); t?.click(); });
    r.mark('extensions'); await p.waitForTimeout(4500);
    r.mark('end-e'); await r.stop();
    // the popup at its real size (380 px wide), as Chrome shows it
    const pp = await ctx.newPage(); await setupPage(pp); await pp.setViewportSize({ width: 380, height: 600 });
    const rp = new Rec(pp, 'E-popup'); await rp.start();
    await pp.goto(`chrome-extension://${id}/popup.html`); rp.mark('popup'); await pp.waitForTimeout(4000);
    await click(pp, pp.getByRole('link', { name: /Look around the demo wallet/ })); rp.mark('demo');
    await pp.waitForTimeout(7000); await pp.mouse.move(190, 400); for (let i = 0; i < 8; i++) { await pp.mouse.wheel(0, 50); await pp.waitForTimeout(80); }
    await pp.waitForTimeout(3000); rp.mark('end-p'); await rp.stop(); await ctx.close();
  }
  stop();
});
