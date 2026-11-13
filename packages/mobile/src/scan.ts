// What a scanned code, a pasted string or a magen:// link means, and where it should take you.
// Pure functions, no React Native imports, so test/scan.test.ts runs them in plain Node.
//
// Pay request format (also what "My code" encodes when you add an amount):
//   magen://pay?to=<account>&amount=<NEAR, up to 24 decimals>&memo=<text, optional>
//   https://magen-near.vercel.app/#/pay?to=…&amount=…&memo=…   (same fields; /pay?… works too)
// Other links: magen://send?to=…&amount=…  magen://receive  magen://scan

export const SITE = 'magen-near.vercel.app';
export type Screen = 'scan' | 'code' | 'send';
export type Scanned =
  | { kind: 'account'; account: string }
  | { kind: 'pay'; to: string; amount?: string; memo?: string; via: 'magen' | 'https' }
  | { kind: 'open'; screen: Screen; to?: string; amount?: string }
  | { kind: 'error'; code: 'empty' | 'too-long' | 'self' | 'mainnet' | 'bad-account' | 'bad-amount' | 'missing-to' | 'dapp' | 'unknown-link' | 'unknown'; message: string };

const err = (code: Extract<Scanned, { kind: 'error' }>['code'], message: string): Scanned => ({ kind: 'error', code, message });
const NAMED = /^(([a-z\d]+[-_])*[a-z\d]+\.)*([a-z\d]+[-_])*[a-z\d]+$/;
const AMOUNT = /^(0|[1-9]\d*)(\.\d{1,24})?$/;
export const MAX_MEMO = 140;

/** A NEAR testnet account id, or a reason it isn't one. Lower-cases first (NEAR ids are lower-case). */
export function checkAccount(raw: string): { ok: boolean; account?: string; code?: 'mainnet' | 'bad-account'; message?: string } {
  const a = raw.trim().toLowerCase();
  if (/^[0-9a-f]{64}$/.test(a) || /^0x[0-9a-f]{40}$/.test(a)) return { ok: true, account: a }; // implicit / eth-implicit
  if (a.length < 2 || a.length > 64 || !NAMED.test(a)) return { ok: false, code: 'bad-account', message: `“${clip(raw)}” is not a NEAR account id.` };
  if (a.endsWith('.near') || a === 'near') return { ok: false, code: 'mainnet', message: `${a} is a NEAR mainnet account. Magen is a testnet preview; use a .testnet account.` };
  if (!a.endsWith('.testnet') || a === 'testnet') return { ok: false, code: 'bad-account', message: `${a} is not a NEAR testnet account (named accounts end in .testnet).` };
  return { ok: true, account: a };
}

/** Converts an amount string to a canonical form, or null when it is not a positive NEAR amount with ≤ 24 decimals. */
export function checkAmount(raw: string): string | null {
  const s = raw.trim();
  if (!AMOUNT.test(s)) return null;
  if (/^0(\.0*)?$/.test(s)) return null;
  return s;
}

const clip = (s: string, n = 40) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

function query(q: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of q.replace(/^\?/, '').split('&')) {
    if (!part) continue;
    const i = part.indexOf('=');
    const k = i < 0 ? part : part.slice(0, i); const v = i < 0 ? '' : part.slice(i + 1);
    try { out[decodeURIComponent(k)] = decodeURIComponent(v.replace(/\+/g, ' ')); } catch { out[k] = v; }
  }
  return out;
}

/** Splits "scheme://host/path?query#frag" without relying on React Native's partial URL class. */
function split(s: string) {
  const m = /^([a-z][a-z0-9+.-]*):(\/\/)?([^/?#]*)([^?#]*)(\?[^#]*)?(#.*)?$/i.exec(s);
  if (!m) return null;
  return { scheme: m[1].toLowerCase(), host: (m[3] ?? '').toLowerCase(), path: m[4] ?? '', query: m[5] ?? '', hash: m[6] ?? '' };
}

function pay(params: Record<string, string>, via: 'magen' | 'https', self?: string): Scanned {
  if (!params.to) return err('missing-to', 'This pay request has no recipient (to=).');
  const c = checkAccount(params.to);
  if (!c.ok) return err(c.code, c.message);
  if (self && c.account === self) return err('self', 'This is your own Magen code. Show it to whoever is paying you.');
  const out: Scanned = { kind: 'pay', to: c.account, via };
  if (params.amount !== undefined && params.amount !== '') {
    const a = checkAmount(params.amount);
    if (!a) return err('bad-amount', `“${clip(params.amount, 30)}” is not a valid NEAR amount (a number above 0, up to 24 decimals).`);
    out.amount = a;
  }
  const memo = (params.memo ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim();
  if (memo) out.memo = memo.slice(0, MAX_MEMO);
  return out;
}

const DAPP = 'This is a dApp signing request. The Magen phone app does not sign dApp requests yet; open it with the Magen Chrome extension.';

/** Reads anything a QR code, the clipboard or a deep link can hold. `self` is this wallet's own account. */
export function parseScan(input: string, self?: string): Scanned {
  const s = (input ?? '').trim();
  if (!s) return err('empty', 'Nothing to read. The code or clipboard is empty.');
  if (s.length > 2048) return err('too-long', 'That code holds too much data to be a NEAR account or a Magen pay request.');
  if (/^wc:/i.test(s)) return err('dapp', DAPP);
  const u = /^[a-z][a-z0-9+.-]*:/i.test(s) ? split(s) : null;
  if (u) {
    if (u.scheme === 'magen') {
      const where = (u.host || u.path.replace(/^\/+/, '').split('/')[0]).toLowerCase();
      const p = query(u.query);
      if (where === 'pay') return pay(p, 'magen', self);
      if (where === 'send') {
        if (!p.to) return { kind: 'open', screen: 'send' };
        const r = pay(p, 'magen', self);
        return r.kind === 'pay' ? { kind: 'open', screen: 'send', to: r.to, ...(r.amount ? { amount: r.amount } : {}) } : r;
      }
      if (where === 'receive' || where === 'code') return { kind: 'open', screen: 'code' };
      if (where === 'scan') return { kind: 'open', screen: 'scan' };
      return err('unknown-link', `Magen doesn't know the link “${clip(s)}”.`);
    }
    if (u.scheme === 'near' || u.scheme === 'near-wallet') return err('dapp', DAPP);
    if (u.scheme === 'https' || u.scheme === 'http') {
      const p = query(u.query);
      if (p.transactions || p.transactionHashes || p.success_url || p.callbackUrl || /\/(sign|login|sign-message)\/?$/i.test(u.path)) return err('dapp', DAPP);
      if (u.host === SITE) {
        const h = /^#\/?([^?]*)(\?.*)?$/.exec(u.hash);
        if (h && h[1].replace(/\/$/, '') === 'pay') return pay(query(h[2] ?? ''), 'https', self);
        if (u.path.replace(/\/$/, '') === '/pay') return pay(p, 'https', self);
        return err('unknown-link', 'That is a link to the Magen website, not a pay request.');
      }
      return err('unknown', `That code is a web link (${clip(u.host, 30)}), not a NEAR account or a Magen pay request.`);
    }
    // Anything else with a scheme falls through: "alice.testnet" never has one.
  }
  if (/\s/.test(s)) return err('unknown', 'That code is not a NEAR account or a Magen pay request.');
  const c = checkAccount(s);
  if (!c.ok) {
    if (c.code === 'mainnet') return err('mainnet', c.message);
    return err(u ? 'unknown' : 'bad-account', u ? 'That code is not a NEAR account or a Magen pay request.' : c.message);
  }
  if (self && c.account === self) return err('self', 'This is your own Magen code. Show it to whoever is paying you.');
  return { kind: 'account', account: c.account };
}

/** What "My code" encodes: the bare account id, or a magen:// pay request once an amount or memo is set. */
export function receiveCode(account: string, amount?: string, memo?: string): string {
  return amount?.trim() || memo?.trim() ? `magen://pay?${payQuery(account, amount, memo)}` : account;
}
function payQuery(account: string, amount?: string, memo?: string) {
  const a = amount?.trim(); const m = memo?.trim();
  let q = `to=${encodeURIComponent(account)}`;
  if (a) q += `&amount=${encodeURIComponent(a)}`;
  if (m) q += `&memo=${encodeURIComponent(m.slice(0, MAX_MEMO))}`;
  return q;
}
/** The https form of the same request, for sharing as a link. */
export const payLink = (account: string, amount?: string, memo?: string) => `https://${SITE}/#/pay?${payQuery(account, amount, memo)}`;
