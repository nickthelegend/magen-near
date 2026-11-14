// Session B (live, NEAR testnet): unlock magen-noam.testnet, show Bitcoin + Zcash deposits minted on NEAR, then
// swap on Ref, bridge out to Solana and send privately to maya-qsafe; each approved on camera and opened on the explorer.
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';
import { withChromeLock } from '/Volumes/Extreme SSD/Projects/grokbot/orchestration/chrome-lock.mjs';
import { Rec, setupPage, click, type, moveTo, APP, V15, keepLock, settle } from './rec.mjs';
const DEMO = '/Volumes/Extreme SSD/Projects/grokbot/projects/magen/.demo/v15';
const PW = readFileSync(`${DEMO}/film-password.txt`, 'utf8').trim();
const BACKUP = readFileSync(`${DEMO}/noam-backup.json`, 'utf8');
const META = readFileSync(`${DEMO}/a-meta.txt`, 'utf8').trim();
const only = (process.argv[2] || 'unlock,bridgein,swap,out,private').split(',');
const out = {}; const save = () => writeFileSync(`${V15}/raw/B-out.json`, JSON.stringify(out, null, 1));
const wheel = async (pg, dy, n = 8) => { await pg.mouse.move(800, 500); for (let i = 0; i < n; i++) { await pg.mouse.wheel(0, dy / n); await pg.waitForTimeout(60); } };
await withChromeLock(async () => {
  const stop = keepLock();
  const b = await chromium.launch({ headless: true });
  const ctx = await b.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1.2 });
  await ctx.addInitScript(bk => { try { localStorage.setItem('magen-backup', bk); } catch {} }, BACKUP);
  const p = await ctx.newPage(); await setupPage(p);
  await p.goto(APP + '#/start', { waitUntil: 'networkidle' }); await p.waitForTimeout(1500);
  const explorer = async (name, opener, hold = 9000, scroll = 0) => {
    const [ex] = await Promise.all([ctx.waitForEvent('page'), opener()]);
    const re = new Rec(ex, name); await re.start(); await ex.waitForLoadState('domcontentloaded').catch(() => {});
    await ex.waitForTimeout(hold); if (scroll) { await wheel(ex, scroll); await ex.waitForTimeout(3500); }
    out[name] = ex.url(); save(); await re.stop(); await ex.close(); await p.bringToFront();
  };
  const openUrl = url => async () => { await p.evaluate(u => window.open(u, '_blank'), url); };
  const nav = async label => { await click(p, p.getByRole('link', { name: label }).first()); await p.waitForTimeout(1200); };
  const approve = async (r, tag) => {
    const dlg = p.getByRole('dialog', { name: 'Approve transaction' });
    await dlg.waitFor({ timeout: 90000 }); r.mark(tag + '-approval'); await p.waitForTimeout(1200);
    await moveTo(p, dlg.locator('dl')); await p.waitForTimeout(1600);
    await moveTo(p, dlg.locator('.approval-locks')); await p.waitForTimeout(2000);
    await click(p, dlg.getByRole('button', { name: 'Approve' })); r.mark(tag + '-approved');
  };
  const r = new Rec(p, 'B-noam'); await r.start();
  try {
    await p.waitForTimeout(1200);
    await click(p, p.getByRole('button', { name: /Unlock my wallet/ })); r.mark('unlock');
    await type(p, p.locator('input[type=password]'), PW, 30);
    await click(p, p.getByRole('button', { name: /^Unlock$/ }));
    await p.waitForURL(/#\/app/); r.mark('home'); await settle(p, r, 'home'); await p.waitForTimeout(7000);
    if (only.includes('bridgein')) {
      await nav(/^Bridge$/); r.mark('bridge-btc');
      await p.locator('a.step', { hasText: '117,485' }).waitFor({ timeout: 40000 }).catch(() => r.mark('no-minted-rows')); await settle(p, r, 'btc');
      await p.waitForTimeout(2500);
      const row = p.locator('a.step', { hasText: '117,485' });
      await moveTo(p, row); await p.waitForTimeout(1200);
      await explorer('B-x-btc-mint', () => click(p, row), 9000);
      r.mark('btc-tx');
      await explorer('B-x-btc-tx', openUrl('https://blockstream.info/testnet/tx/81c3252954955553a2c81d10db5336a6bf651fafb9b82640da0388882d3bd095'), 8000, 500);
      await click(p, p.getByRole('button', { name: /Zcash/ })); r.mark('bridge-zec'); await settle(p, r, 'zec'); await p.waitForTimeout(7000);
    }
    if (only.includes('swap')) {
      await nav(/^Swap$/); r.mark('swap');
      const amt = p.getByLabel('Amount in NEAR'); await click(p, amt); await amt.fill(''); await p.keyboard.type('0.5', { delay: 120 });
      await settle(p, r, 'swap'); await p.waitForTimeout(3500);
      await click(p, p.getByRole('button', { name: /Swap · signed twice/ }));
      await approve(r, 'swap');
      await p.locator('.result').waitFor({ timeout: 120000 }); r.mark('swap-done'); await p.waitForTimeout(3000);
      out.swap = await p.locator('.result a').first().getAttribute('href'); save();
      await explorer('B-x-swap', () => click(p, p.locator('.result a').first()), 8000, 700);
    }
    if (only.includes('out')) {
      await nav(/^Bridge$/); await click(p, p.getByRole('button', { name: /Send from NEAR/ })); r.mark('out');
      await click(p, p.getByRole('button', { name: /Solana/ }));
      const amt = p.getByLabel('Amount in NEAR'); await click(p, amt); await amt.fill(''); await p.keyboard.type('0.3', { delay: 120 });
      await p.getByText(/wNEAR on Solana/).waitFor({ timeout: 30000 }); await p.waitForTimeout(2500);
      await click(p, p.getByRole('button', { name: /Bridge · signed twice/ }));
      await approve(r, 'out');
      await p.locator('.result').waitFor({ timeout: 120000 }); r.mark('out-done'); await p.waitForTimeout(6000);
      out.out = await p.locator('.result a').first().getAttribute('href'); save();
      await explorer('B-x-out', () => click(p, p.locator('.result a').first()), 8000, 700);
    }
    if (only.includes('private')) {
      await nav(/Private send/); r.mark('private');
      await type(p, p.getByPlaceholder('magen-meta:…'), META, 4);
      const amt = p.getByLabel('Amount (NEAR)'); await click(p, amt); await amt.fill(''); await p.keyboard.type('0.2', { delay: 120 });
      await p.waitForTimeout(1200);
      await click(p, p.getByRole('button', { name: /Sign twice and send privately/ }));
      await approve(r, 'private');
      await p.locator('.result').first().waitFor({ timeout: 120000 }); r.mark('private-done'); await p.waitForTimeout(4000);
      out.private = await p.locator('.result a').first().getAttribute('href'); save();
      await explorer('B-x-private', () => click(p, p.locator('.result a').first()), 8000, 600);
    }
    if (only.includes('out')) {
      await nav(/^Bridge$/); await click(p, p.getByRole('button', { name: /Send from NEAR/ })); r.mark('out-check');
      await p.waitForTimeout(5000);
    }
    r.mark('end-b');
  } catch (e) { r.mark('ERROR', { msg: String(e.message).slice(0, 300) }); console.error(e); await p.screenshot({ path: `${V15}/shots/errB.png` }).catch(() => {}); }
  finally { await r.stop(); save(); await b.close(); stop(); }
});
