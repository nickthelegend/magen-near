// Film v6 capture: real Chrome (Playwright Chromium) with the Magen extension loaded, real NEAR testnet.
// Each page records its own video; marks.json holds event times (ms since that page opened) for the edit.
// Secrets are read from .demo/ and typed into masked fields; nothing is printed.
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync, renameSync } from 'node:fs';
import { withChromeLock } from '/Volumes/Extreme SSD/Projects/grokbot/orchestration/chrome-lock.mjs';

const root = '/Volumes/Extreme SSD/Projects/grokbot/projects/magen';
const out = `${root}/videos/magen-near/v6/raw`;
mkdirSync(out, { recursive: true });
const ext = `${root}/packages/extension/dist`;
const leo = JSON.parse(readFileSync(`${root}/.demo/plain-magen-leo.testnet.json`, 'utf8'));
const drill = readFileSync(`${root}/.demo/drill-film.json`, 'utf8');
const pw = readFileSync(`${root}/.demo/ext-password.txt`, 'utf8').trim();
const only = process.argv.slice(2);
const want = n => !only.length || only.includes(n);
const marks = {};
const W = ms => new Promise(r => setTimeout(r, ms));

await withChromeLock(async () => {
  const ctx = await chromium.launchPersistentContext(`${root}/.tools/film-profile`, {
    channel: 'chromium', headless: true, viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1,
    recordVideo: { dir: out, size: { width: 1440, height: 900 } },
    args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`],
  });
  let [sw] = ctx.serviceWorkers(); if (!sw) sw = await ctx.waitForEvent('serviceworker');
  const id = new URL(sw.url()).host;
  const take = async (name, fn) => {
    if (!want(name)) return;
    const page = await ctx.newPage(); const t0 = Date.now(); marks[name] = {};
    const mark = k => { marks[name][k] = Date.now() - t0; };
    try { await fn(page, mark); } catch (e) { marks[name].error = String(e.message).slice(0, 300); }
    const v = page.video(); await page.close();
    if (v) renameSync(await v.path(), `${out}/${name}.webm`);
    writeFileSync(`${out}/marks.json`, JSON.stringify(marks, null, 2));
  };
  const popupPage = async page => { await page.setViewportSize({ width: 400, height: 700 }); };

  await take('landing', async (p, mark) => {
    await p.goto('http://localhost:5340/#/'); await W(1200); mark('hero'); await W(5000);
    const box = p.getByLabel('NEAR account to scan');
    await box.click(); mark('type'); await box.pressSequentially('root.near', { delay: 90 }); await p.keyboard.press('Enter');
    await p.getByText('rests on').waitFor({ timeout: 30000 }); mark('scanned'); await W(800);
    await p.mouse.wheel(0, 520); await W(6500); mark('scanread');
    await p.evaluate(() => document.getElementById('how').scrollIntoView({ behavior: 'smooth' })); await W(1500); mark('how');
    await p.mouse.wheel(0, 380); await W(7000);
    await p.evaluate(() => document.getElementById('get').scrollIntoView({ behavior: 'smooth' })); await W(1500); mark('get'); await W(6000);
  });

  await take('upgrade', async (p, mark) => {
    await popupPage(p);
    await p.goto(`chrome-extension://${id}/popup.html#/start/upgrade/magen-leo.testnet`); await W(1500); mark('open');
    await p.locator('textarea').fill(leo.secret); await W(700);
    await p.getByRole('button', { name: 'Check this account' }).click();
    await p.getByText('Ready:').waitFor({ timeout: 30000 }); mark('ready'); await W(2500);
    await p.locator('input[type=password]').nth(0).fill(pw); await p.locator('input[type=password]').nth(1).fill(pw);
    await p.getByRole('checkbox').check(); await W(600);
    await p.getByRole('button', { name: /Upgrade in place/ }).click(); mark('submit');
    await p.getByText('now has two locks').waitFor({ timeout: 90000 }); mark('done'); await W(3500);
    await p.goto(`chrome-extension://${id}/popup.html#/app`); await W(6000); mark('home'); await W(3000);
  });

  if (want('dapp')) {   // unlock the wallet first (a new browser session starts locked)
    const u = await ctx.newPage(); await u.goto(`chrome-extension://${id}/popup.html#/start/unlock`); await W(800);
    await u.locator('input[type=password]').fill(pw); await u.getByRole('button', { name: 'Unlock' }).click(); await W(1500);
    const uv = u.video(); await u.close(); if (uv) await uv.delete().catch(() => {});
  }
  await take('dapp', async (p, mark) => {
    await p.goto('http://localhost:5340/dapp/index.html'); await W(2500); mark('open');
    if (await p.locator('#connect').isVisible()) {
      const [c] = await Promise.all([ctx.waitForEvent('page'), p.getByRole('button', { name: 'Connect Magen' }).click()]);
      await c.setViewportSize({ width: 400, height: 700 }); await W(1800); await c.getByRole('button', { name: 'Connect' }).click();
    }
    await p.getByText('Connected: magen-leo.testnet').waitFor({ timeout: 20000 }); mark('connected'); await W(1500);
    await p.getByRole('button', { name: '0.1', exact: true }).click(); await W(600);
    const [a] = await Promise.all([ctx.waitForEvent('page'), p.getByRole('button', { name: /Send 0.1 NEAR tip/ }).click()]);
    mark('approveOpen'); await a.setViewportSize({ width: 400, height: 700 });
    const av = a.video();
    await W(2600); mark('approveClick'); await a.getByRole('button', { name: /Approve/ }).click();
    await a.getByText(/Both signatures verified|Refused/).waitFor({ timeout: 60000 }); mark('approveDone');
    await p.locator('#out').waitFor({ state: 'visible', timeout: 30000 }); mark('dappDone'); await W(4500);
    if (av) { await a.close().catch(() => {}); try { renameSync(await av.path(), `${out}/approve.webm`); } catch {} }
    marks.dapp.tx = await p.locator('#out a').getAttribute('href').catch(() => null);
  });

  await take('drill', async (p, mark) => {
    await p.addInitScript(s => { try { localStorage.setItem('magen-drill', s); } catch {} }, drill);
    await p.goto('http://localhost:5340/#/app/drill'); await W(5000); mark('ready');
    await p.getByRole('button', { name: /Run the attacker/ }).click(); mark('run');
    await p.getByText('Both keys found').waitFor({ timeout: 120000 }); mark('cracked');
    await p.getByText('Drained', { exact: true }).waitFor({ timeout: 60000 }); mark('drained');
    await p.getByText('Refused on chain: quantum half missing').first().waitFor({ timeout: 60000 }); mark('refused'); await W(5000);
    marks.drill.txs = await p.locator('.verdict a').evaluateAll(as => as.map(a => a.href));
  });

  await take('tour', async (p, mark) => {
    await popupPage(p);
    await p.goto(`chrome-extension://${id}/popup.html#/start/unlock`); await W(800);
    await p.locator('input[type=password]').fill(pw); await p.getByRole('button', { name: 'Unlock' }).click(); await W(1500); mark('unlocked');
    for (const r of ['app', 'app/activity', 'app/security', 'app/qday', 'app/receive']) {
      await p.goto(`chrome-extension://${id}/popup.html#/${r}`); await W(r === 'app/activity' ? 6500 : 5000); mark(r);
    }
  });

  await take('webapp', async (p, mark) => {
    await p.goto('http://localhost:5340/#/app'); await W(6000); mark('home');
    await p.goto('http://localhost:5340/#/app/activity'); await W(6000); mark('activity');
  });
  await ctx.close();
});
writeFileSync(`${out}/marks.json`, JSON.stringify(marks, null, 2));
console.log(JSON.stringify(marks, null, 1));
