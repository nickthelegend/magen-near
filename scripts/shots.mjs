// UI QA: every route at 1440 and 375, full page, with horizontal-overflow and runtime-error checks.
// Usage: node scripts/shots.mjs <outdir-name> [route ...]
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { withChromeLock } from '/Volumes/Extreme SSD/Projects/grokbot/orchestration/chrome-lock.mjs';

const name = process.argv[2] || 'v2';
const ROUTES = process.argv.slice(3).length ? process.argv.slice(3) : ['', 'scan/root.near', 'app', 'app/send', 'app/receive', 'app/activity', 'app/security', 'app/qday', 'app/drill', 'start', 'start/upgrade/drill-mwf4jsnn.testnet', 'start/unlock'];
const dir = `/Volumes/Extreme SSD/Projects/grokbot/orchestration/shots/magen/${name}`;
mkdirSync(dir, { recursive: true });
const rows = [], errors = [];
await withChromeLock(async () => {
  const b = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    for (const width of [1440, 375]) {
      const ctx = await b.newContext({ viewport: { width, height: width === 1440 ? 900 : 812 }, deviceScaleFactor: width === 1440 ? 1 : 2 });
      const p = await ctx.newPage();
      p.on('pageerror', e => errors.push(`${width} ${e.message}`));
      p.on('console', m => { if (m.type() === 'error') errors.push(`${width} console: ${m.text().slice(0, 200)}`); });
      for (const route of ROUTES) {
        await p.goto(`http://localhost:5340/#/${route}`);
        await p.waitForTimeout(route.startsWith('scan') ? 5000 : route.startsWith('app') ? 4500 : 1500);
        const file = `${(route || 'landing').replace(/\//g, '_')}-${width}.png`;
        await p.screenshot({ path: `${dir}/${file}`, fullPage: true });
        const overflow = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
        rows.push({ route: '#/' + route, width, overflow, file });
      }
      await ctx.close();
    }
  } finally { await b.close(); }
});
writeFileSync(`${dir}/qa.json`, JSON.stringify({ at: new Date().toISOString(), rows, errors }, null, 2));
console.log(rows.filter(r => r.overflow > 0).map(r => `OVERFLOW ${r.route} ${r.width} +${r.overflow}`).join('\n') || 'no overflow');
console.log(errors.slice(0, 12).join('\n') || 'no errors');
