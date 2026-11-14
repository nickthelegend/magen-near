// Session C (live, NEAR testnet): unlock maya-safe.testnet again, set up 2-of-3 guardians, flip the Q-Day switch,
// prove the native ML-DSA-65 key; every transaction approved on camera then opened on the explorer.
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';
import { withChromeLock } from '/Volumes/Extreme SSD/Projects/grokbot/orchestration/chrome-lock.mjs';
import { Rec, setupPage, click, type, moveTo, APP, V15, keepLock, settle } from './rec.mjs';
const DEMO = '/Volumes/Extreme SSD/Projects/grokbot/projects/magen/.demo/v15';
const PW = readFileSync(`${DEMO}/a-password.txt`, 'utf8').trim();
const only = (process.argv[2] || 'guardians,qday,prove').split(',');
const out = {}; const save = () => writeFileSync(`${V15}/raw/C-out.json`, JSON.stringify(out, null, 1));
const wheel = async (pg, dy, n = 8) => { await pg.mouse.move(800, 500); for (let i = 0; i < n; i++) { await pg.mouse.wheel(0, dy / n); await pg.waitForTimeout(60); } };
await withChromeLock(async () => {
  const stop = keepLock();
  const b = await chromium.launch({ headless: true });
  const ctx = await b.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1.2, storageState: `${DEMO}/a-state.json`, acceptDownloads: true });
  const p = await ctx.newPage(); await setupPage(p);
  await p.goto(APP + '#/start', { waitUntil: 'networkidle' }); await p.waitForTimeout(1500);
  const explorer = async (name, opener, hold = 9000, scroll = 0) => {
    const [ex] = await Promise.all([ctx.waitForEvent('page'), opener()]);
    const re = new Rec(ex, name); await re.start(); await ex.waitForLoadState('domcontentloaded').catch(() => {});
    await ex.waitForTimeout(hold); if (scroll) { await wheel(ex, scroll); await ex.waitForTimeout(3500); }
    out[name] = ex.url(); save(); await re.stop(); await ex.close(); await p.bringToFront();
  };
  const nav = async label => { await click(p, p.getByRole('link', { name: label }).first()); await p.waitForTimeout(1200); };
  const approve = async (r, tag) => {
    const dlg = p.getByRole('dialog', { name: 'Approve transaction' });
    await dlg.waitFor({ timeout: 90000 }); r.mark(tag + '-approval'); await p.waitForTimeout(1200);
    await moveTo(p, dlg.locator('dl')); await p.waitForTimeout(1600);
    await moveTo(p, dlg.locator('.approval-locks')); await p.waitForTimeout(2000);
    await click(p, dlg.getByRole('button', { name: 'Approve' })); r.mark(tag + '-approved');
  };
  const r = new Rec(p, 'C-maya'); await r.start();
  try {
    await p.waitForTimeout(1200);
    await click(p, p.getByRole('button', { name: /Unlock my wallet/ })); r.mark('unlock');
    await type(p, p.locator('input[type=password]'), PW, 30);
    await click(p, p.getByRole('button', { name: /^Unlock$/ }));
    await p.waitForURL(/#\/app/); r.mark('home'); await settle(p, r, 'home'); await p.waitForTimeout(3000);
    if (only.includes('guardians')) {
      await nav(/Keys & guardians/); r.mark('security'); await settle(p, r, 'security'); await p.waitForTimeout(2500);
      const btn = p.getByRole('button', { name: /Set up 2-of-3 guardians/ });
      await btn.scrollIntoViewIfNeeded(); await p.waitForTimeout(1500);
      await click(p, btn);
      await approve(r, 'guardians');
      const link = p.getByRole('link', { name: /View the guardian transaction/ });
      await link.waitFor({ timeout: 120000 }); r.mark('guardians-done'); await p.waitForTimeout(4500);
      await moveTo(p, p.locator('.keylist').first()).catch(() => {}); await p.waitForTimeout(2500);
      out.guardians = await link.getAttribute('href'); save();
      await explorer('C-x-guardians', () => click(p, link), 8000, 600);
    }
    if (only.includes('qday')) {
      await nav(/Q-Day switch/); r.mark('qday'); await settle(p, r, 'qday'); await p.waitForTimeout(3000);
      await click(p, p.getByText(/I understand: after the switch/));
      await click(p, p.getByRole('switch', { name: 'Q-Day switch' }));
      await approve(r, 'qday');
      const link = p.getByRole('link', { name: /View the switch transaction/ });
      await link.waitFor({ timeout: 120000 }); r.mark('qday-done');
      await p.getByText('Switched on').first().waitFor({ timeout: 60000 }).catch(() => r.mark('no-switched-on'));
      await settle(p, r, 'qday2'); await p.waitForTimeout(5000);
      out.qday = await link.getAttribute('href'); save();
      await explorer('C-x-qday', () => click(p, link), 8000, 600);
      await explorer('C-x-keys', () => click(p, p.getByRole('link', { name: /key list/ })), 9000, 500);
    }
    if (only.includes('prove')) {
      await click(p, p.getByRole('button', { name: /Prove it/ }));
      await approve(r, 'prove');
      const banner = p.locator('.banner-green');
      await banner.waitFor({ timeout: 120000 }); r.mark('prove-done'); await p.waitForTimeout(4000);
      out.prove = await banner.locator('a').first().getAttribute('href'); save();
      await explorer('C-x-prove', () => click(p, banner.locator('a').first()), 8000, 0);
    }
    r.mark('end-c');
  } catch (e) { r.mark('ERROR', { msg: String(e.message).slice(0, 300) }); console.error(e); await p.screenshot({ path: `${V15}/shots/errC.png` }).catch(() => {}); }
  finally { await r.stop(); save(); await b.close(); stop(); }
});
