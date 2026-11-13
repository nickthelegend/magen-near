// End-to-end test of the Magen Chrome extension on NEAR testnet, in Playwright's Chromium with --load-extension.
// 1) a plain testnet account is made (sub-account of our relay, so no faucet is needed),
// 2) the extension popup upgrades it in place,
// 3) the demo dApp connects through window.magen and sends a tip; the approval window signs twice.
// Keys stay in .demo/ (gitignored); nothing is printed.
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { withChromeLock } from '/Volumes/Extreme SSD/Projects/grokbot/orchestration/chrome-lock.mjs';
import { execFileSync } from 'node:child_process';

const root = '/Volumes/Extreme SSD/Projects/grokbot/projects/magen';
const ext = `${root}/packages/extension/dist`;
const shots = '/Volumes/Extreme SSD/Projects/grokbot/orchestration/shots/magen/extension';
mkdirSync(shots, { recursive: true });
const profile = process.env.MAGEN_PROFILE || `${root}/.tools/chrome-ext-profile-${Date.now()}`;
const reuse = !!process.env.MAGEN_PROFILE;
let made = null;
if (!reuse) {
  // Make the "existing" account with the SDK; the secret goes to .demo/ only.
  const out = JSON.parse(execFileSync('npx', ['tsx', 'scripts/make-plain-account.ts', process.argv[2] || 'e2e', '3'], { cwd: root, encoding: 'utf8' }).trim().split('\n').pop());
  made = JSON.parse(readFileSync(`${root}/${out.file}`, 'utf8'));
}
const password = readFileSync(`${root}/.demo/ext-password.txt`, 'utf8').trim();
const log = [];
await withChromeLock(async () => {
  const ctx = await chromium.launchPersistentContext(profile, {
    channel: 'chromium', headless: true, viewport: { width: 1280, height: 860 },
    args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`],
  });
  try {
    let [sw] = ctx.serviceWorkers(); if (!sw) sw = await ctx.waitForEvent('serviceworker');
    const id = new URL(sw.url()).host;
    const popup = await ctx.newPage(); await popup.setViewportSize({ width: 380, height: 640 });
    if (!reuse) {
      await popup.goto(`chrome-extension://${id}/popup.html#/start/upgrade/${made.account}`);
      await popup.getByRole('textbox').nth(1).fill(made.secret);
      await popup.getByRole('button', { name: 'Check this account' }).click();
      await popup.getByText('Ready:').waitFor({ timeout: 30000 });
      await popup.locator('input[type=password]').nth(0).fill(password);
      await popup.locator('input[type=password]').nth(1).fill(password);
      await popup.getByRole('checkbox').check();
      await popup.screenshot({ path: `${shots}/popup-upgrade.png` });
      await popup.getByRole('button', { name: /Upgrade in place/ }).click();
      await popup.getByText('now has two locks').waitFor({ timeout: 90000 });
      log.push({ step: 'extension upgraded account in place', account: made.account, tx: await popup.locator('a.link').first().getAttribute('href') });
    } else {
      await popup.goto(`chrome-extension://${id}/popup.html#/start/unlock`);
      await popup.locator('input[type=password]').fill(password);
      await popup.getByRole('button', { name: 'Unlock' }).click();
      await popup.waitForTimeout(1500);
    }
    await popup.goto(`chrome-extension://${id}/popup.html#/app`); await popup.waitForTimeout(5000);
    await popup.screenshot({ path: `${shots}/popup-home.png` });

    const acct = await sw.evaluate(async () => (await chrome.storage.session.get('magen-session'))['magen-session']?.wallet);
    log.push({ step: 'profile', profile, account: acct });
    const dapp = await ctx.newPage();
    dapp.on('console', m => log.push({ dappConsole: m.text().slice(0, 160) }));
    await dapp.goto('http://localhost:5340/dapp/index.html'); await dapp.waitForTimeout(1500);
    log.push({ magen: await dapp.evaluate(() => !!window.magen), hint: await dapp.locator('#hint').innerText() });
    await dapp.screenshot({ path: `${shots}/dapp-before.png` });
    if (await dapp.locator('#connect').isVisible()) {
      const [connectWin] = await Promise.all([ctx.waitForEvent('page'), dapp.getByRole('button', { name: 'Connect Magen' }).click()]);
      await connectWin.waitForLoadState(); await connectWin.getByRole('button', { name: 'Connect' }).click();
    }
    await dapp.getByText(`Connected: ${acct}`).waitFor({ timeout: 15000 });
    await dapp.getByRole('button', { name: '0.1', exact: true }).click();
    const [approveWin] = await Promise.all([ctx.waitForEvent('page'), dapp.getByRole('button', { name: /Send 0.1 NEAR tip/ }).click()]);
    await approveWin.waitForLoadState(); await approveWin.waitForTimeout(800);
    await approveWin.screenshot({ path: `${shots}/approve-before.png` });
    approveWin.on('console', m => log.push({ approveConsole: m.text().slice(0, 200) }));
    approveWin.on('pageerror', e => log.push({ approveError: e.message.slice(0, 200) }));
    await approveWin.getByRole('button', { name: /Approve/ }).click();
    await approveWin.getByText(/Both signatures verified|Refused/).waitFor({ timeout: 60000 });
    await approveWin.screenshot({ path: `${shots}/approve-after.png` });
    await dapp.locator('#out').waitFor({ state: 'visible', timeout: 30000 });
    await dapp.screenshot({ path: `${shots}/dapp-after.png` });
    log.push({ step: 'dApp tip via window.magen', result: await dapp.locator('#out').innerText(), tx: await dapp.locator('#out a').getAttribute('href').catch(() => null) });
  } catch (e) { log.push({ error: String(e.message).slice(0, 300) }); process.exitCode = 1; let i = 0; for (const pg of ctx.pages()) { try { await pg.screenshot({ path: `${shots}/error-${i++}.png` }); log.push({ page: pg.url(), text: (await pg.locator('body').innerText()).slice(0, 600) }); } catch {} } } finally { await ctx.close(); }
});
writeFileSync(`${root}/deployments/extension-e2e.json`, JSON.stringify({ at: new Date().toISOString(), browser: 'Playwright Chromium, --load-extension', log }, null, 2));
console.log(JSON.stringify(log, null, 1));
