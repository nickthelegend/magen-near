// Records the NEAR Rocks explorer page of the phone account after its Q-Day switch (read-only).
import { chromium } from 'playwright';
import { renameSync, writeFileSync } from 'node:fs';
import { withChromeLock } from '/Volumes/Extreme SSD/Projects/grokbot/orchestration/chrome-lock.mjs';
const out = '/Volumes/Extreme SSD/Projects/grokbot/projects/magen/videos/magen-near/v6/raw';
const acct = process.argv[2] || 'magen-maya.testnet';
const marks = {};
await withChromeLock(async () => {
  const b = await chromium.launch({ channel: 'chrome', headless: true });
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, recordVideo: { dir: out, size: { width: 1440, height: 900 } } });
  const p = await ctx.newPage(); const t0 = Date.now();
  await p.goto(`https://testnet.near.rocks/account/${acct}`, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
  await p.waitForTimeout(3500); marks.loaded = Date.now() - t0;
  const keys = p.getByText('Access Keys').first();
  await keys.click().catch(e => marks.clickErr = e.message);
  await p.waitForTimeout(1500); marks.expanded = Date.now() - t0;
  marks.text = (await p.locator('body').innerText()).slice(0, 1200);
  await p.screenshot({ path: `${out}/explorer.png` });
  await p.waitForTimeout(5000);
  const v = p.video(); await ctx.close(); renameSync(await v.path(), `${out}/explorer.webm`);
  await b.close();
});
writeFileSync(`${out}/explorer-marks.json`, JSON.stringify(marks, null, 1));
console.log(JSON.stringify(marks, null, 1));
