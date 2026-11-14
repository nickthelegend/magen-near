// Session A (live, NEAR testnet): create maya-qsafe.testnet in the web app, approve the creation on camera, open it on the explorer,
// then show the new wallet's chains and its private-receive code. Saves storage state so session C can unlock the same wallet.
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { withChromeLock } from '/Volumes/Extreme SSD/Projects/grokbot/orchestration/chrome-lock.mjs';
import { Rec, setupPage, click, type, moveTo, APP, V15, keepLock, settle } from './rec.mjs';
const DEMO = '/Volumes/Extreme SSD/Projects/grokbot/projects/magen/.demo/v15';
const NAME = process.argv[2] || 'maya-qsafe';
const pwFile = `${DEMO}/a-password.txt`;
if (!existsSync(pwFile)) writeFileSync(pwFile, 'maya-' + randomBytes(9).toString('base64url'), { mode: 0o600 });
const PW = readFileSync(pwFile, 'utf8').trim();
const out = { name: NAME + '.testnet' };
await withChromeLock(async () => {
  const stop = keepLock();
  const b = await chromium.launch({ headless: true });
  const ctx = await b.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1.2 });
  await ctx.addInitScript(() => { try { localStorage.clear(); } catch {} });
  const p = await ctx.newPage(); await setupPage(p);
  await p.goto(APP + '#/start', { waitUntil: 'networkidle' }); await p.waitForTimeout(1500);
  // stop clearing localStorage on later navigations
  await ctx.addInitScript(() => {});
  const r = new Rec(p, 'A-create'); await r.start();
  try {
    await p.waitForTimeout(1500);
    r.mark('choose');
    await click(p, p.getByRole('button', { name: /Create a new wallet/ }));
    r.mark('name');
    await type(p, p.getByPlaceholder('yourname'), NAME, 90);
    await p.getByText('Available').waitFor({ timeout: 15000 }); await p.waitForTimeout(1200);
    await click(p, p.getByRole('button', { name: /Continue/ }));
    r.mark('words-hidden'); await p.waitForTimeout(1500);
    const box = await p.locator('.phrase').boundingBox();
    await click(p, p.getByRole('button', { name: /Tap to reveal/ }));
    r.mark('words-shown', { box }); await p.waitForTimeout(4000);
    await click(p, p.getByText('I wrote them down somewhere safe.'));
    await click(p, p.getByRole('button', { name: /Continue/ }));
    r.mark('words-hidden-end');
    r.mark('chains'); await p.waitForTimeout(8000);
    await click(p, p.getByRole('button', { name: /Continue/ }));
    r.mark('password');
    const pws = p.locator('input[type=password]');
    await type(p, pws.nth(0), PW, 25); await type(p, pws.nth(1), PW, 25);
    await moveTo(p, p.locator('.txplan')); await p.waitForTimeout(2000);
    await click(p, p.getByRole('button', { name: /Create wallet/ }));
    r.mark('creating');
    const dlg = p.getByRole('dialog', { name: 'Approve transaction' });
    await dlg.waitFor({ timeout: 90000 }); r.mark('approval'); await p.waitForTimeout(1500);
    await moveTo(p, dlg.locator('.approval-locks')); await p.waitForTimeout(2200);
    await click(p, dlg.getByRole('button', { name: 'Approve' }));
    r.mark('approved');
    await p.locator('.result.ok').waitFor({ timeout: 120000 }); r.mark('done');
    const href = await p.locator('.result.ok a').first().getAttribute('href'); out.createTx = href; r.mark('tx', { href });
    await p.waitForTimeout(2500);
    // explorer in a new tab (the link opens a new tab)
    const [ex] = await Promise.all([ctx.waitForEvent('page'), click(p, p.locator('.result.ok a').first())]);
    const re = new Rec(ex, 'A-explorer-create'); await re.start();
    await ex.waitForLoadState('domcontentloaded'); await ex.waitForTimeout(9000);
    await ex.mouse.move(800, 500); for (let i = 0; i < 8; i++) { await ex.mouse.wheel(0, 60); await ex.waitForTimeout(60); }
    await ex.waitForTimeout(3000); await re.stop(); await ex.close();
    r.mark('back'); await p.waitForTimeout(800);
    await click(p, p.getByRole('link', { name: /Open my wallet/ }));
    r.mark('home'); await settle(p, r, 'home'); await p.waitForTimeout(7000);
    await p.mouse.move(800, 500); for (let i = 0; i < 10; i++) { await p.mouse.wheel(0, 50); await p.waitForTimeout(70); }
    await p.waitForTimeout(2500);
    await click(p, p.getByRole('link', { name: /All chains/ }).first());
    r.mark('chains-page'); await settle(p, r, 'chains'); await p.waitForTimeout(7000);
    await click(p, p.getByRole('link', { name: /Private send/ }).first());
    await p.waitForTimeout(1200);
    await click(p, p.getByRole('button', { name: /Receive privately/ }));
    r.mark('receive-private'); await p.waitForTimeout(4000);
    out.meta = await p.locator('.addr').first().innerText().catch(() => '');
    r.mark('end-a');
  } catch (e) { r.mark('ERROR', { msg: String(e.message).slice(0, 300) }); console.error(e); await p.screenshot({ path: `${V15}/shots/errA.png` }).catch(() => {}); }
  finally {
    await r.stop();
    await ctx.storageState({ path: `${DEMO}/a-state.json` });
    writeFileSync(`${V15}/raw/A-out.json`, JSON.stringify({ name: out.name, createTx: out.createTx }, null, 1));
    if (out.meta) writeFileSync(`${DEMO}/a-meta.txt`, out.meta, { mode: 0o600 });
    await b.close(); stop();
  }
});
