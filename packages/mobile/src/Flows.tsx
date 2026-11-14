// Phone screens for Receive (every chain), Swap on Ref, Bridge in (BTC/ZEC via Omni) and Bridge out (Solana via Omni).
// All reads are live testnet calls; every NEAR transaction stops in the approval sheet and is signed twice.
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, ActivityIndicator, Animated, Easing, Image, Linking, Modal, Pressable, TextInput, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { ArrowDown, ArrowDownToLine, ArrowUpFromLine, Atom, Check, Copy, ExternalLink, Info, Repeat, ShieldAlert, ShieldCheck } from 'lucide-react-native';
import { nearAmount } from '../../../sdk/index.ts';
import { deriveAll } from '../../../sdk/hd.ts';
import { chainAddresses } from '../../../sdk/phase2.ts';
import { PAIRS, ftBalance, refPool, refQuote, swapNearFor, type Pair } from '../../../sdk/swap.ts';
import { OUT_ROUTES, UTXO, bridgeOut, bridgedBalance, depositAddress, outFee, outStatus, splBalance, type UtxoChain } from '../../../sdk/omni.ts';
import { accountUrl, friendlyError, near, short, txUrl } from '../../../web/src/lib/chain.ts';
import { Back, Btn, Card, Err, Pill, T, feeSigner, styles, type P } from './ui';
import { Qr, Screen, decimal } from './Screen';
import { ShieldSend } from './TabBar';
import { C, FONT, LOGO, MONO } from './theme';
import { StripeBar, units } from './Assets';

const openUrl = (u: string) => Linking.openURL(u);
/** deriveAll runs PBKDF2 + ML-DSA keygen in JS; do it once per phrase. */
const dcache = new Map<string, ReturnType<typeof deriveAll>>();
export const derived = (m: string) => { let d = dcache.get(m); if (!d) { d = deriveAll(m); dcache.set(m, d); } return d; };
/** Friendly text for rate limits and dropped connections; everything else passes through friendlyError. */
export const nice = (e: any) => { const m = String(e?.message ?? e); return /429|rate.?limit/i.test(m) ? 'The testnet server is busy (rate limit). Wait a few seconds and try again.' : /Network request failed|unreachable|timeout/i.test(m) ? 'No connection to the testnet server. Check the internet and try again.' : friendlyError(m); };

/** Retry quietly while a public testnet server rate-limits (HTTP 429); `wait` tells the screen it is retrying. */
export async function retrying<T>(fn: () => Promise<T>, wait?: (busy: boolean) => void, tries = 5): Promise<T> {
  for (let i = 0; ; i++) {
    try { const r = await fn(); wait?.(false); return r; }
    catch (e: any) { if (i >= tries - 1 || !/429|rate.?limit|busy|timeout|unreachable|Network request failed/i.test(String(e?.message ?? e))) { wait?.(false); throw e; } wait?.(true); await new Promise(r => setTimeout(r, 2500 * (i + 1))); }
  }
}
const Busy = ({ on }: { on: boolean }) => on ? <T style={{ color: C.text3, fontSize: 12.5 }}>The testnet server is busy. Retrying by itself…</T> : null;
const spendable = (live: P['live']) => live?.amount != null ? live.amount - BigInt(live.storage) * 10n ** 19n - 5n * 10n ** 23n : null;

const Seg = ({ value, set, items }: { value: string; set: (v: any) => void; items: [string, string, any?][] }) => <View style={styles.seg}>
  {items.map(([k, label, Icon]) => <Pressable key={k} onPress={() => { Haptics.selectionAsync(); set(k); }} style={[styles.segBtn, value === k && styles.segOn, { flexDirection: 'row', gap: 6 }]} accessibilityRole="tab" accessibilityState={{ selected: value === k }}>
    {Icon && <Icon color={value === k ? C.text : C.text3} size={15} />}<T style={{ fontWeight: '600', color: value === k ? C.text : C.text3, fontSize: 14 }}>{label}</T></Pressable>)}
</View>;
const KV = ({ rows }: { rows: [string, any][] }) => <Card>{rows.map(([k, v], i) => <View key={k} style={[styles.row, { paddingVertical: 11 }, i === rows.length - 1 && { borderBottomWidth: 0 }]}>
  <T style={{ color: 'rgba(255,255,255,0.62)', fontSize: 14, width: 112 }}>{k}</T><View style={{ flex: 1, alignItems: 'flex-end' }}>{typeof v === 'string' ? <T style={{ fontWeight: '600', fontSize: 14, textAlign: 'right' }}>{v}</T> : v}</View></View>)}</Card>;
const ChainLogo = ({ id, size = 22 }: { id: string; size?: number }) => <View style={[styles.ico, { backgroundColor: '#fff', width: size + 18, height: size + 18, borderRadius: (size + 18) / 2 }]}>
  {LOGO[id] ? <Image source={LOGO[id]} style={{ width: size, height: size }} resizeMode="contain" /> : <T style={{ color: C.bg, fontWeight: '700' }}>{id[0].toUpperCase()}</T>}</View>;
function CopyBtn({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [ok, setOk] = useState(false);
  return <Pressable onPress={async () => { await Clipboard.setStringAsync(text); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); setOk(true); setTimeout(() => setOk(false), 1400); }} hitSlop={10} accessibilityRole="button" accessibilityLabel={`${label} ${text}`}
    style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, height: 34, borderRadius: 17, backgroundColor: ok ? C.accentSoft : C.s2, borderWidth: 1, borderColor: ok ? C.accentLine : C.line }}>
    {ok ? <Check color={C.accent} size={15} /> : <Copy color={C.text2} size={15} />}<T style={{ fontSize: 13, fontWeight: '600', color: ok ? C.accentText : C.text2 }}>{ok ? 'Copied' : label}</T></Pressable>;
}
/** Pending → done/failed banner with the explorer link. */
export function TxBanner({ state, title, sub, links }: { state: 'pending' | 'ok' | 'bad'; title: string; sub?: string; links?: [string, string][] }) {
  const tone = state === 'bad' ? { bg: C.redSoft, bd: 'rgba(255,90,106,0.3)', fg: C.redText } : state === 'ok' ? { bg: C.accentSoft, bd: C.accentLine, fg: C.text } : { bg: C.s1, bd: C.line, fg: C.text };
  return <View style={[styles.banner, { backgroundColor: tone.bg, borderColor: tone.bd }]}>
    {state === 'pending' ? <ActivityIndicator color={C.accent} /> : state === 'ok' ? <ShieldCheck color={C.accent} size={20} /> : <ShieldAlert color={C.red} size={20} />}
    <View style={{ flex: 1, gap: 4 }}><T style={{ fontWeight: '600', fontSize: 15, color: tone.fg }}>{title}</T>{sub ? <T style={{ color: C.text2, fontSize: 13, lineHeight: 19 }}>{sub}</T> : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 16, rowGap: 4 }}>{(links ?? []).map(([label, url]) => <Pressable key={url} onPress={() => openUrl(url)} hitSlop={6} accessibilityRole="link" style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><T style={{ color: C.accentText, fontWeight: '600' }}>{label}</T><ExternalLink color={C.accentText} size={13} /></Pressable>)}</View></View>
  </View>;
}

/* ---------- Receive ---------- */
type Addr = { id: string; name: string; network: string; address: string };
export function useAddresses(p: P) {
  const [rows, setRows] = useState<Addr[] | null>(null); const [err, setErr] = useState('');
  useEffect(() => {
    let on = true;
    if (p.vault.mnemonic) { setTimeout(() => { try { const d = derived(p.vault.mnemonic!); on && setRows(d.chains.filter(c => c.id !== 'near').map(c => ({ id: c.id, name: c.name, network: c.network, address: c.address }))); } catch (e: any) { on && setErr(e.message); } }, 30); }
    else retrying(() => chainAddresses(p.vault.wallet)).then((a: any[]) => on && setRows(a.map(x => ({ id: x.id, name: x.name, network: x.network, address: x.address })))).catch(e => on && setErr(nice(e)));
    return () => { on = false; };
  }, [p.vault.wallet]);
  return { rows, err, fromWords: !!p.vault.mnemonic };
}
export function ReceiveTab(p: P) {
  const { rows, err, fromWords } = useAddresses(p);
  const [sel, setSel] = useState<Addr | null>(null);
  const cur = sel ?? { id: 'near', name: 'NEAR', network: 'testnet', address: p.vault.wallet };
  return <Screen action={<View style={{ flexDirection: 'row', gap: 10 }}>
    <View style={{ flex: 1 }}><Btn title={`Copy ${cur.name} address`} onPress={() => { Clipboard.setStringAsync(cur.address); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); }} icon={<Copy color="#fff" size={18} />} /></View></View>}>
    <Back go={p.go} title="Receive" sub="Pick a chain. Share the code or the address; receiving never needs a signature." />
    <Card style={{ padding: 20, gap: 14, alignItems: 'center' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><ChainLogo id={cur.id} size={16} /><T style={{ fontWeight: '600', fontSize: 16 }}>{cur.name} <T style={{ color: C.text3, fontSize: 13 }}>{cur.network}</T></T></View>
      <Qr value={cur.address} size={190} />
      <T selectable style={{ fontFamily: MONO, fontSize: 13, textAlign: 'center', color: C.text }}>{cur.address}</T>
      <T style={{ color: C.text3, fontSize: 12.5, textAlign: 'center', lineHeight: 18 }}>{cur.id === 'near' ? 'Your account name is your address. Send NEAR, nBTC, nZEC or USDT here on NEAR testnet.' : cur.id === 'bitcoin' || cur.id === 'zcash' ? `Coins sent here stay on ${cur.name}. To bring them onto NEAR, use Bridge in.` : `Only send ${cur.name} ${cur.network} coins to this address.`}</T>
    </Card>
    <Card>
      <View style={styles.cardHead}><T style={styles.h2}>Every chain</T><T style={{ color: C.text3, fontSize: 12.5 }}>{fromWords ? 'from your 12 words' : 'from NEAR\'s MPC'}</T></View>
      {[{ id: 'near', name: 'NEAR', network: 'testnet', address: p.vault.wallet }, ...(rows ?? [])].map((a, i, all) => <Pressable key={a.id} onPress={() => { Haptics.selectionAsync(); setSel(a.id === 'near' ? null : a); }}
        style={[styles.row, i === all.length - 1 && { borderBottomWidth: 0 }, cur.id === a.id && { backgroundColor: C.accentSoft }]} accessibilityRole="button" accessibilityLabel={`Show ${a.name} address`}>
        <ChainLogo id={a.id} /><View style={{ flex: 1 }}><T style={{ fontWeight: '600' }}>{a.name} <T style={{ color: C.text3, fontSize: 12 }}>{a.network}</T></T>
          <T numberOfLines={1} style={{ fontFamily: MONO, fontSize: 12, color: C.text2, marginTop: 2 }}>{short(a.address, 12, 8)}</T></View>
        <CopyBtn text={a.address} /></Pressable>)}
      {rows === null && !err && <ActivityIndicator color={C.accent} style={{ padding: 16 }} />}
    </Card>
    {!!err && <Err text={err} />}
  </Screen>;
}

/* ---------- Swap on Ref ---------- */
const f24 = (v: bigint, places = 4) => units(v, 24, places);
/** Token pill: logo + symbol, magenta when selected. */
const TokenPill = ({ id, symbol, on, onPress }: { id: string; symbol: string; on?: boolean; onPress?: () => void }) => <Pressable disabled={!onPress} onPress={onPress} accessibilityRole={onPress ? 'button' : undefined} accessibilityState={onPress ? { selected: !!on } : undefined}
  style={[styles.chip, { height: 40, borderRadius: 20, paddingLeft: 5 }, on && styles.chipOn]}>
  <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>{LOGO[id] ? <Image source={LOGO[id]} style={{ width: 18, height: 18 }} resizeMode="contain" /> : <T style={{ color: C.bg, fontWeight: '800', fontSize: 12 }}>{symbol.slice(0, 1)}</T>}</View>
  <T style={{ fontWeight: '700', fontSize: 15, color: '#fff' }}>{symbol}</T></Pressable>;
/** Three-step progress: striped magenta bar + numbered steps (done = magenta check, current = spinner). */
function Steps({ at, items, logo, failed }: { at: number; items: [string, string][]; logo: any; failed?: boolean }) {
  const done = at >= items.length;
  return <Card style={{ padding: 18, gap: 14 }}>
    <StripeBar pct={done ? 1 : Math.max(0.12, (at + 0.5) / items.length)} logo={logo} label={done ? 'Done' : failed ? 'Stopped' : items[Math.min(at, items.length - 1)][0] + '…'} />
    {items.map(([t, sub], i) => { const ok = i < at; const now = i === at && !failed;
      return <View key={t} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={[styles.ico, { width: 32, height: 32, backgroundColor: ok ? C.accent : C.s2 }]}>{ok ? <Check color="#fff" size={15} strokeWidth={3} /> : now ? <ActivityIndicator color={C.accent} size="small" /> : <T style={{ color: C.text3, fontWeight: '700' }}>{i + 1}</T>}</View>
        <View style={{ flex: 1 }}><T style={{ fontWeight: '600', color: ok || now ? C.text : C.text3 }}>{t}</T><T style={{ color: C.text3, fontSize: 12.5 }}>{sub}</T></View>
      </View>; })}
  </Card>;
}

/** Chain → chain header: two logos joined by a moving striped magenta line (static under reduced motion). */
function Route({ from, to, fromNet, toNet, via }: { from: [string, string]; to: [string, string]; fromNet: string; toNet: string; via: string }) {
  const x = useRef(new Animated.Value(0)).current;
  useEffect(() => { let loop: any; AccessibilityInfo.isReduceMotionEnabled().then(r => { if (r) return; loop = Animated.loop(Animated.timing(x, { toValue: 1, duration: 900, easing: Easing.linear, useNativeDriver: true })); loop.start(); }); return () => loop?.stop(); }, []);
  const End = ({ c, net }: { c: [string, string]; net: string }) => <View style={{ alignItems: 'center', gap: 4, width: 92 }}><ChainLogo id={c[0]} size={26} /><T style={{ fontWeight: '600', fontSize: 15 }}>{c[1]}</T><T style={{ color: 'rgba(255,255,255,0.62)', fontSize: 13 }}>{net}</T></View>;
  return <Card style={{ padding: 18 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <End c={from} net={fromNet} />
      <View style={{ flex: 1, alignItems: 'center', gap: 8, marginTop: -26 }}>
        <View style={{ width: '100%', height: 8, borderRadius: 4, overflow: 'hidden', backgroundColor: C.accent }}>
          <Animated.View style={{ flexDirection: 'row', width: 400, transform: [{ translateX: x.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) }] }}>
            {Array.from({ length: 40 }, (_, i) => <View key={i} style={{ width: 10, height: 8, backgroundColor: i % 2 ? C.accent2 : C.accent, transform: [{ skewX: '-35deg' }] }} />)}
          </Animated.View>
        </View>
        <T style={{ color: 'rgba(255,255,255,0.62)', fontSize: 13 }}>{via}</T>
      </View>
      <End c={to} net={toNet} />
    </View>
  </Card>;
}
/** Seen → Confirmations → Minted as three striped segments. */
const DepSteps = ({ at }: { at: number }) => <View style={{ flexDirection: 'row', gap: 4, marginTop: 8 }}>
  {['Seen on Bitcoin', 'Confirmed', 'Minted on NEAR'].map((t, i) => <View key={t} style={{ flex: 1, gap: 4 }}>
    <View style={{ height: 6, borderRadius: 3, backgroundColor: i < at ? C.accent : C.s3, overflow: 'hidden', flexDirection: 'row' }}>{i < at && Array.from({ length: 12 }, (_, k) => <View key={k} style={{ width: 8, height: 6, backgroundColor: k % 2 ? C.accent2 : C.accent, transform: [{ skewX: '-35deg' }] }} />)}</View>
    <T style={{ fontSize: 11.5, color: i < at ? C.accentText : 'rgba(255,255,255,0.5)', fontWeight: '600' }}>{t}</T></View>)}
</View>;
/** The overlapping round magenta arrow between "You pay" and "You get". */
const Flip = () => <View style={{ alignItems: 'center', height: 0, zIndex: 3 }}><View style={{ marginTop: -24, width: 48, height: 48, borderRadius: 24, backgroundColor: C.accent, borderWidth: 5, borderColor: C.bg, alignItems: 'center', justifyContent: 'center', shadowColor: C.accent, shadowOpacity: 0.45, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } }}><ArrowDown color="#fff" size={20} strokeWidth={2.6} /></View></View>;

export function SwapTab(p: P) {
  const { vault, live, refresh, go } = p;
  const [pair, setPair] = useState<Pair>(PAIRS[0]);
  const [amt, setAmt] = useState('1');
  const [quote, setQuote] = useState<bigint | null>(null); const [qErr, setQErr] = useState('');
  const [pool, setPool] = useState<Awaited<ReturnType<typeof refPool>> | null>(null);
  const [bal, setBal] = useState<bigint | null>(null);
  const [busy, setBusy] = useState(''); const [err, setErr] = useState('');
  const [res, setRes] = useState<{ hash: string; success: boolean; error: string; received: bigint } | null>(null);
  const [wait, setWait] = useState(false); const [pick, setPick] = useState(false); const [pickBal, setPickBal] = useState<Record<string, bigint>>({});
  useEffect(() => { if (!pick) return; PAIRS.forEach(x => ftBalance(x.token, vault.wallet).then(b => setPickBal(m => ({ ...m, [x.id]: b }))).catch(() => {})); }, [pick]);
  let amountIn = 0n; try { amountIn = amt ? BigInt(nearAmount(amt)) : 0n; } catch { /* invalid */ }
  useEffect(() => { let on = true; setQuote(null); setQErr(''); if (amountIn <= 0n) return; const t = setTimeout(() => retrying(() => refQuote(pair, amountIn), w => on && setWait(w)).then(q => on && setQuote(q)).catch(e => on && setQErr(nice(e))), 300); return () => { on = false; clearTimeout(t); }; }, [pair, amt]);
  useEffect(() => { let on = true; const load = () => { refPool(pair).then(x => on && setPool(x)).catch(() => {}); ftBalance(pair.token, vault.wallet).then(b => on && setBal(b)).catch(() => on && setBal(0n)); }; load(); const i = setInterval(load, 20000); return () => { on = false; clearInterval(i); }; }, [pair, vault.wallet, res]);
  const rate = quote && amountIn > 0n ? Number(quote * 10000n / amountIn) / 10000 : null;
  const version = live?.status?.version;
  const swap = async () => {
    setErr(''); setRes(null);
    try {
      if (amountIn <= 0n) throw Error('Enter an amount above zero.');
      const sp = spendable(live); if (sp !== null && amountIn + 3n * 10n ** 21n > sp) throw Error(`Not enough NEAR. You can swap up to ${near(sp > 0n ? sp : 0n, 4)} NEAR.`);
      setBusy('Signing with both keys…');
      const r = await swapNearFor(feeSigner(vault, live), vault.wallet, vault.keys, pair, amountIn);
      setRes(r); p.addLocal({ hash: r.hash, time: Date.now(), success: r.success, kind: r.success ? 'call' : 'refused', title: r.success ? 'Swapped on Ref' : 'Swap refused', detail: r.success ? `${amt} NEAR for ${f24(r.received)} ${pair.symbol} · signed twice` : friendlyError(r.error) }); Haptics.notificationAsync(r.success ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error); refresh();
    } catch (e: any) { setErr(nice(e)); } finally { setBusy(''); }
  };
  return <Screen notice={<>{!!busy && <TxBanner state="pending" title="Swapping on NEAR testnet…" sub="Your wallet checks both signatures, wraps NEAR, then trades on Ref." />}
      {res && (res.success ? <TxBanner state="ok" title={`Swapped. You got ${f24(res.received)} ${pair.symbol}.`} sub="Four calls ran under one dual-signed approval." links={[['View on NEAR Rocks', txUrl(res.hash)]]} />
        : <TxBanner state="bad" title={friendlyError(res.error)} sub="Nothing was swapped." links={[['View the transaction', txUrl(res.hash)]]} />)}
      {!!err && <Err text={err} />}</>}
    action={res?.success ? <Btn title="Swap again" kind="ghost" onPress={() => setRes(null)} icon={<Repeat color="#fff" size={18} />} />
    : <Btn title={busy || 'Review swap'} busy={!!busy} disabled={!quote || (version && version !== 'magen-3')} onPress={swap} icon={<ShieldSend size={22} />} />}>
    <Back go={go} title="Swap" sub="Trade NEAR for a testnet stablecoin on Ref Finance, NEAR's exchange. One approval, signed twice." />
    <View style={{ gap: 8 }}>
      <Card style={{ padding: 18, paddingBottom: 26, gap: 6 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}><T s="label">You pay</T>
          {(() => { const sp = spendable(live); const mx = sp !== null && sp > 4n * 10n ** 21n ? sp - 4n * 10n ** 21n : null; return mx !== null && !busy && !res ? <Pressable onPress={() => { setAmt(units(mx, 24, 4).replace(/,/g, '')); setRes(null); setErr(''); }} hitSlop={8} accessibilityRole="button" accessibilityLabel="Use the maximum" style={{ paddingHorizontal: 10, height: 26, borderRadius: 13, backgroundColor: C.accentSoft, justifyContent: 'center' }}><T style={{ color: C.accentText, fontWeight: '700', fontSize: 12.5 }}>Max</T></Pressable> : null; })()}</View>
        <View style={{ flexDirection: 'row', alignItems: 'center', height: 62, gap: 10 }}>
          <TextInput selectionColor={C.accent} style={{ flex: 1, minWidth: 0, fontFamily: FONT.display, fontSize: 42, letterSpacing: -1.5, color: C.text }} keyboardType="decimal-pad" value={amt} onChangeText={t => { setAmt(decimal(t)); setRes(null); setErr(''); }} editable={!busy} accessibilityLabel="Amount in NEAR" />
          <TokenPill id="near" symbol="NEAR" />
        </View>
        <T style={{ color: C.text3, fontSize: 13 }}>Available {(() => { const sp = spendable(live); return sp === null ? '…' : near(sp > 0n ? sp : 0n, 4); })()} NEAR · 0.5 stays for storage</T>
      </Card>
      <Flip />
      <Card style={{ padding: 18, paddingTop: 26, gap: 6, backgroundColor: C.s2 }}>
        <T s="label">You get (estimated)</T>
        <View style={{ flexDirection: 'row', alignItems: 'center', height: 58, gap: 10 }}>
          <T display style={{ flex: 1, minWidth: 0, fontSize: 40, letterSpacing: -1.4, color: quote ? C.text : C.text3 }} numberOfLines={1} adjustsFontSizeToFit>{amountIn <= 0n ? '0' : quote === null ? (qErr ? '—' : '…') : f24(quote)}</T>
          <TokenPill id={pair.id} symbol={pair.symbol + ' ⌄'} onPress={busy ? undefined : () => { Haptics.selectionAsync(); setPick(true); }} />
        </View>
        <T style={{ color: C.text3, fontSize: 13, marginTop: 4 }}>You hold {bal === null ? '…' : f24(bal)} {pair.symbol} · {pair.label}</T>
      </Card>
    </View>
    <Modal transparent visible={pick} animationType="slide" onRequestClose={() => setPick(false)}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(5,6,8,0.72)' }} onPress={() => setPick(false)} accessibilityLabel="Close" />
      <View style={{ backgroundColor: C.s1, borderTopLeftRadius: 28, borderTopRightRadius: 28, borderWidth: 1, borderColor: C.line, padding: 20, paddingBottom: 40, gap: 6 }}>
        <View style={{ alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: C.line2, marginBottom: 10 }} />
        <T display style={{ fontSize: 22, marginBottom: 6 }}>Receive token</T>
        {PAIRS.map(x => <Pressable key={x.id} onPress={() => { Haptics.selectionAsync(); setPair(x); setRes(null); setPick(false); }} accessibilityRole="button" style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, height: 64, paddingHorizontal: 12, borderRadius: 18, backgroundColor: pair.id === x.id ? C.accentSoft : pressed ? C.s2 : 'transparent' })}>
          <ChainLogo id={x.id} size={20} /><View style={{ flex: 1 }}><T style={{ fontWeight: '600', fontSize: 16 }}>{x.symbol}</T><T style={{ color: 'rgba(255,255,255,0.62)', fontSize: 13 }}>{x.label} · pool #{x.pool}</T></View>
          <T style={{ fontWeight: '600', fontSize: 15 }}>{x.id in pickBal ? f24(pickBal[x.id]) : '…'}</T></Pressable>)}
      </View>
    </Modal>
    {(!!busy || res?.success) && <Steps at={res?.success ? 3 : 1} logo={LOGO[pair.id] ?? LOGO.near} items={[['Signed twice', 'ed25519 + ML-DSA-65 on this phone'], ['NEAR checks both', 'Your wallet contract verifies, then runs 4 calls'], ['Swapped on Ref', res?.success ? `You got ${f24(res.received)} ${pair.symbol}` : `Pool #${pair.pool} fills the trade`]]} />}
    {res?.success && <Card style={{ padding: 20, alignItems: 'center', gap: 4, backgroundColor: C.accentSoft, borderColor: C.accentLine }}>
      <T style={{ color: C.text2, fontSize: 14 }}>You received</T>
      <T display style={{ fontSize: 40, letterSpacing: -1.2 }}>+{f24(res.received)} <T style={{ fontSize: 18, color: C.text2 }}>{pair.symbol}</T></T>
      <T style={{ color: C.text2, fontSize: 14 }}>Balance now {bal === null ? '…' : f24(bal)} {pair.symbol}</T>
    </Card>}
    <KV rows={[['Rate', rate ? `1 NEAR = ${rate.toFixed(4)} ${pair.symbol}` : '…'],
      ['Price impact', (() => { if (!pool || !quote || amountIn <= 0n || pool.near <= 0n) return '…'; const spot = Number(pool.other) / Number(pool.near) * (1 - pool.feeBps / 10000); const eff = Number(quote) / Number(amountIn); const imp = Math.max(0, (1 - eff / spot) * 100); return imp < 0.01 ? '< 0.01%' : `${imp.toFixed(2)}%`; })()],
      ['Min received', quote ? `${f24(quote * 99n / 100n)} ${pair.symbol}` : '…'], ['Route', `Ref Finance · pool #${pair.pool}${pool ? ` · ${pool.feeBps / 100}% fee` : ''}`],
      ['Network fee', '≤ 0.03 NEAR gas, unused refunded'], ['Signed by', 'ed25519 + ML-DSA-65']]} />
    {version && version !== 'magen-3' && <Err text={`This wallet runs contract ${version}. Swaps need magen-3 (one approval for four calls): create a new wallet to swap.`} />}
    {!!qErr && <Err text={qErr} />}
    <Busy on={wait} />
  </Screen>;
}

/* ---------- Bridge ---------- */
export function BridgeTab(p: P) {
  const [dir, setDir] = useState<'in' | 'out'>('in');
  return dir === 'in' ? <BridgeIn {...p} seg={<Seg value={dir} set={setDir} items={[['in', 'Bring to NEAR', ArrowDownToLine], ['out', 'Send to Solana', ArrowUpFromLine]]} />} />
    : <BridgeOut {...p} seg={<Seg value={dir} set={setDir} items={[['in', 'Bring to NEAR', ArrowDownToLine], ['out', 'Send to Solana', ArrowUpFromLine]]} />} />;
}

const DEMO = 'magen-noam.testnet';
type Dep = { txid: string; value: number; confirmed: boolean; minted?: string };
/** Bitcoin deposits to an address, and whether Omni has minted each one as nBTC on NEAR. */
async function deposits(address: string): Promise<Dep[]> {
  const r = await fetch(`https://blockstream.info/testnet/api/address/${address}/txs`, { signal: AbortSignal.timeout(15000) });
  if (!r.ok) throw Error(`Blockstream answered HTTP ${r.status}`);
  const txs: any[] = await r.json();
  return Promise.all(txs.slice(0, 5).map(async t => {
    const vout = t.vout.findIndex((o: any) => o.scriptpubkey_address === address);
    const value = t.vout.filter((o: any) => o.scriptpubkey_address === address).reduce((s: number, o: any) => s + o.value, 0);
    const tr = vout < 0 ? null : await fetch(`https://testnet.api.bridge.nearone.org/api/v4/transfers/transfer?utxo_chain=btc&utxo_tx_hash=${t.txid}&utxo_vout=${vout}`).then(x => x.ok ? x.json() : null).then(j => j?.transfers?.[0] ?? null).catch(() => null);
    return { txid: t.txid, confirmed: !!t.status?.confirmed, value, minted: tr?.finalised?.transaction_hash as string | undefined };
  }));
}

function BridgeIn(p: P & { seg: any }) {
  const [chain, setChain] = useState<UtxoChain>('btc');
  const [who, setWho] = useState(p.vault.wallet);
  const [d, setD] = useState<Awaited<ReturnType<typeof depositAddress>> | null>(null);
  const [err, setErr] = useState(''); const [bal, setBal] = useState<bigint | null>(null);
  const [seen, setSeen] = useState<Dep[] | null>(null); const [seenErr, setSeenErr] = useState('');
  const c = UTXO[chain]; const mine = who === p.vault.wallet; const [wait, setWait] = useState(false);
  useEffect(() => { let on = true; setD(null); setErr(''); retrying(() => depositAddress(chain, who), w => on && setWait(w)).then(x => on && setD(x)).catch(e => on && setErr(nice(e))); return () => { on = false; }; }, [chain, who]);
  useEffect(() => { let on = true; setBal(null); const load = () => bridgedBalance(chain, who).then(b => on && setBal(b)).catch(() => on && setBal(x => x ?? 0n)); load(); const i = setInterval(load, 20000); return () => { on = false; clearInterval(i); }; }, [chain, who]);
  useEffect(() => {
    setSeen(null); setSeenErr(''); if (chain !== 'btc' || !d) return;
    let on = true; const load = () => retrying(() => deposits(d.address)).then(x => on && setSeen(x)).catch(e => on && setSeenErr(nice(e)));
    load(); const i = setInterval(load, 25000); return () => { on = false; clearInterval(i); };
  }, [chain, d]);
  const conf = d ? String(Object.values(d.confirmations ?? {})[0] ?? '') || null : null;
  return <Screen>
    <Back go={p.go} title="Bridge" sub="Bring Bitcoin or Zcash onto NEAR, or send NEAR out to Solana. Omni Bridge does the moving; your two locks guard it on NEAR." />
    {p.seg}
    <Route from={chain === 'btc' ? ['bitcoin', 'Bitcoin'] : ['zcash', 'Zcash']} fromNet="testnet" to={['near', chain === 'btc' ? 'nBTC' : 'nZEC']} toNet="on NEAR" via="Omni Bridge" />
    <View style={{ flexDirection: 'row', gap: 8 }}>{(Object.keys(UTXO) as UtxoChain[]).map(k => <Pressable key={k} onPress={() => setChain(k)} style={[styles.chip, chain === k && styles.chipOn]} accessibilityRole="button" accessibilityState={{ selected: chain === k }}>
      <View style={styles.chipLogo}><Image source={LOGO[k === 'btc' ? 'bitcoin' : 'zcash']} style={{ width: 14, height: 14 }} resizeMode="contain" /></View><T style={{ fontWeight: '600', color: chain === k ? '#fff' : C.text2 }}>{UTXO[k].name}</T></Pressable>)}</View>
    {!mine && <View style={[styles.banner, { backgroundColor: C.s1, borderColor: C.line, alignItems: 'center' }]}><Info color={C.text2} size={18} />
      <T style={{ flex: 1, color: C.text2, fontSize: 13.5 }}>Showing the demo wallet {DEMO} (read only).</T><Pressable onPress={() => setWho(p.vault.wallet)} hitSlop={8}><T style={{ color: C.accentText, fontWeight: '600' }}>Mine</T></Pressable></View>}
    <Card style={{ padding: 16, gap: 10, alignItems: 'center' }}>
      <T style={{ fontWeight: '600', fontSize: 16, textAlign: 'center' }}>{mine ? 'Your' : `${DEMO}'s`} {c.name} {c.network} deposit address</T>
      {err ? <Err text={`Address not shown: ${err}`} /> : !d ? <View style={{ height: 240, justifyContent: 'center' }}><ActivityIndicator color={C.accent} /><T style={{ color: C.text3, marginTop: 10, textAlign: 'center' }}>{wait ? 'The testnet server is busy. Retrying by itself…' : `Asking the ${c.name} connector on NEAR…`}</T></View>
        : <><Qr value={d.address} size={150} /><T selectable style={{ fontFamily: MONO, fontSize: 13, textAlign: 'center' }}>{d.address}</T>
          {mine ? <CopyBtn text={d.address} label={`Copy ${c.name} address`} /> : <Pressable onPress={() => setWho(p.vault.wallet)} hitSlop={8}><T style={{ color: C.accentText, fontWeight: '600' }}>Back to my deposit address</T></Pressable>}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><Check color={C.accent} size={14} /><T style={{ color: C.accentText, fontSize: 12.5 }}>Made on chain by {c.connector}; the bridge API agrees</T></View></>}
    </Card>
    {d && <KV rows={[['Minimum', `${d.minDeposit.toLocaleString('en-US')} ${c.unit}`], ['Confirmations', conf ?? '…'], ['Bridge fee', `from ${d.feeMin.toLocaleString('en-US')} ${c.unit}`],
      [`${c.symbol} on NEAR`, bal === null ? '…' : `${units(bal, 8, 8)} ${c.symbol}`]]} />}
    {chain === 'zcash' && <View style={[styles.banner, { backgroundColor: C.s1, borderColor: C.line }]}><Info color={C.text2} size={18} /><T style={{ flex: 1, color: C.text2, fontSize: 13.5, lineHeight: 19 }}>This is a transparent Zcash address, so the deposit is public. Deposit status is tracked for Bitcoin; your nZEC balance above updates when a Zcash deposit is minted.</T></View>}
    {chain === 'btc' && d && <Card>
      <View style={styles.cardHead}><T style={styles.h2}>Deposits</T>{seen && <Pill tone="blue" text="live" />}</View>
      {seenErr ? <View style={{ padding: 16 }}><T style={{ color: C.text2 }}>{seenErr}</T></View>
        : seen === null ? <ActivityIndicator color={C.accent} style={{ padding: 18 }} />
        : seen.length === 0 ? <View style={{ padding: 16, gap: 6 }}><T style={{ fontWeight: '600' }}>Nothing has arrived yet.</T>
          <T style={{ color: C.text2, fontSize: 13.5, lineHeight: 19 }}>Send at least {d.minDeposit.toLocaleString('en-US')} sats of Bitcoin testnet3 to the address above from any Bitcoin testnet wallet. It shows here, then is minted as nBTC on NEAR.</T>
          {mine && <Pressable onPress={() => setWho(DEMO)} hitSlop={6}><T style={{ color: C.accentText, fontWeight: '600', marginTop: 4 }}>See a real deposit on the demo wallet</T></Pressable>}</View>
        : seen.map((s, i) => <Pressable key={s.txid} onPress={() => openUrl(s.minted ? txUrl(s.minted) : c.explorerTx(s.txid))} style={[styles.row, i === seen.length - 1 && { borderBottomWidth: 0 }]} accessibilityRole="link">
          <View style={[styles.ico, { backgroundColor: s.minted ? C.accentSoft : C.s2 }]}>{s.minted ? <Check color={C.accent} size={18} /> : <ActivityIndicator color={C.accent} />}</View>
          <View style={{ flex: 1 }}><T style={{ fontWeight: '600', fontSize: 15 }}>{s.value.toLocaleString('en-US')} sats</T>
            <T style={{ color: s.minted ? C.accentText : 'rgba(255,255,255,0.62)', fontSize: 13, marginTop: 2 }}>{s.minted ? `Minted as nBTC on NEAR · ${short(s.minted)}` : s.confirmed ? 'Confirmed on Bitcoin, waiting for the bridge' : 'Seen on Bitcoin, confirming'}</T>
            <DepSteps at={s.minted ? 3 : s.confirmed ? 2 : 1} /></View>
          <ExternalLink color={C.text3} size={16} /></Pressable>)}
    </Card>}
    <T style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, lineHeight: 18 }}>Steps: send {c.name} → {conf ?? 'a few'} confirmations → the Omni relayer proves it to NEAR → {c.symbol} is minted to {mine ? 'your wallet' : DEMO}. Moving it afterwards needs both of your signatures.</T>
  </Screen>;
}

const arrived = (s: { status: string; destTx?: string } | null) => !!s && (!!s.destTx || ['Finalised', 'Claimed', 'Settled'].includes(s.status));
const PLAIN: Record<string, string> = { Initialised: 'Started on NEAR. The bridge is picking it up…', Signed: 'The bridge signed it. Sending to Solana…' };
function BridgeOut(p: P & { seg: any }) {
  const { vault, live, refresh } = p;
  const route = OUT_ROUTES.find(r => r.id === 'solana')!;
  const [mySol, setMySol] = useState('');
  useEffect(() => { if (vault.mnemonic) setTimeout(() => { try { setMySol(derived(vault.mnemonic!).chains.find(c => c.id === 'solana')?.address ?? ''); } catch { /* typed instead */ } }, 30); }, [vault.mnemonic]);
  const [typed, setTyped] = useState('');
  const to = mySol || typed.trim();
  const [amt, setAmt] = useState('0.5');
  const [fee, setFee] = useState<bigint | null>(null); const [feeErr, setFeeErr] = useState('');
  const [busy, setBusy] = useState(''); const [err, setErr] = useState('');
  const [res, setRes] = useState<{ hash: string; success: boolean; error: string } | null>(null);
  const [st, setSt] = useState<{ status: string; destTx?: string } | null>(null);
  const [dest, setDest] = useState<number | null>(null);
  let amount = 0n; try { amount = amt ? BigInt(nearAmount(amt)) : 0n; } catch { /* invalid */ }
  const validTo = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(to);
  useEffect(() => { let on = true; setFee(null); setFeeErr(''); if (!validTo || amount <= 0n) return; const t = setTimeout(() => retrying(() => outFee(vault.wallet, route, to, amount)).then(q => on && setFee(q.fee)).catch(e => on && setFeeErr(nice(e))), 300); return () => { on = false; clearTimeout(t); }; }, [to, amt]);
  useEffect(() => { if (!validTo) return; let on = true; const load = () => splBalance(to).then(b => on && setDest(Number(b.amount) / 10 ** b.decimals)).catch(() => {}); load(); const i = setInterval(load, 10000); return () => { on = false; clearInterval(i); }; }, [to, st?.status]);
  useEffect(() => {
    if (!res?.success) return;
    let on = true; let n = 0;
    const poll = async () => { const s = await outStatus(res.hash).catch(() => null); if (on && s) setSt(s); if (on && !arrived(s) && n++ < 120) setTimeout(poll, 5000); };
    poll(); return () => { on = false; };
  }, [res]);
  const go = async () => {
    setErr(''); setRes(null); setSt(null);
    try {
      if (!validTo) throw Error('Enter a Solana devnet address.');
      if (fee === null) throw Error('Waiting for the bridge fee quote.');
      const sp = spendable(live); if (sp !== null && amount + 3n * 10n ** 21n > sp) throw Error(`Not enough NEAR. You can bridge up to ${near(sp > 0n ? sp : 0n, 4)} NEAR.`);
      setBusy('Signing with both keys…');
      const r = await bridgeOut(feeSigner(vault, live), vault.wallet, vault.keys, route, to, amount);
      setRes(r); p.addLocal({ hash: r.hash, time: Date.now(), success: r.success, kind: r.success ? 'call' : 'refused', title: r.success ? 'Bridged to Solana' : 'Bridge refused', detail: r.success ? `${amt} NEAR via Omni Bridge · signed twice` : friendlyError(r.error), amount: r.success ? amount.toString() : undefined }); Haptics.notificationAsync(r.success ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error); refresh();
    } catch (e: any) { setErr(nice(e)); } finally { setBusy(''); }
  };
  const done = arrived(st);
  const version = live?.status?.version;
  return <Screen notice={<>{!!busy && <TxBanner state="pending" title="Sending to the bridge…" sub="Your wallet checks both signatures, wraps NEAR and hands it to Omni Bridge." />}
      {res && (res.success ? <TxBanner state={done ? 'ok' : 'pending'} title={done ? 'Arrived on Solana.' : st ? (PLAIN[st.status] ?? `Bridge status: ${st.status}`) : 'Signed on NEAR. Waiting for the bridge relayer…'}
        sub={done ? 'Both signatures were checked on NEAR before the bridge got a single token.' : 'This usually takes a minute or two. You can leave this screen.'}
        links={[['NEAR transaction', txUrl(res.hash)], ...(st?.destTx ? [['Solana transaction', route.explorerTx(st.destTx)] as [string, string]] : []), ...(done ? [['Your Solana tokens', `https://explorer.solana.com/address/${to}/tokens?cluster=devnet`] as [string, string]] : [])]} />
        : <TxBanner state="bad" title={friendlyError(res.error)} sub="Nothing left NEAR." links={[['View the transaction', txUrl(res.hash)]]} />)}
      {!!err && <Err text={err} />}</>}
    action={res?.success ? <Btn title="Send more to Solana" kind="ghost" onPress={() => { setRes(null); setSt(null); }} />
    : <Btn title={busy || 'Sign twice and bridge'} busy={!!busy} disabled={!fee || !validTo || (version && version !== 'magen-3')} onPress={go} icon={<ShieldSend size={22} />} />}>
    <Back go={p.go} title="Bridge" sub="Bring Bitcoin or Zcash onto NEAR, or send NEAR out to Solana. Omni Bridge does the moving; your two locks guard it on NEAR." />
    {p.seg}
    <Route from={['near', 'NEAR']} fromNet="testnet" to={['solana', 'Solana']} toNet="devnet" via="Omni Bridge" />
    <Card style={{ padding: 18, gap: 10 }}>
      <T s="label">Amount</T>
      <View style={{ flexDirection: 'row', alignItems: 'center', height: 60 }}>
        <TextInput selectionColor={C.accent} style={{ flex: 1, minWidth: 0, fontFamily: FONT.display, fontSize: 42, letterSpacing: -1.5, color: C.text }} keyboardType="decimal-pad" value={amt} onChangeText={t => { setAmt(decimal(t)); setRes(null); setErr(''); }} editable={!busy} accessibilityLabel="Amount in NEAR" />
        <TokenPill id="near" symbol="NEAR" />
      </View>
      <T style={{ color: C.text3, fontSize: 13 }}>Available {(() => { const sp = spendable(live); return sp === null ? '…' : near(sp > 0n ? sp : 0n, 4); })()} NEAR · arrives as wNEAR on Solana</T>
    </Card>
    {vault.mnemonic ? null : <Card style={{ padding: 18, gap: 10 }}><T s="label">Your Solana devnet address</T>
      <TextInput selectionColor={C.accent} style={[styles.input, { fontFamily: MONO, fontSize: 13 }]} placeholder="Solana address" placeholderTextColor={C.text3} value={typed} onChangeText={setTyped} autoCapitalize="none" autoCorrect={false} />
      <T style={{ color: C.text3, fontSize: 12.5 }}>Wallets made from 12 words fill this in for you.</T></Card>}
    <KV rows={[['To', to ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}><Image source={LOGO.solana} style={{ width: 13, height: 13 }} resizeMode="contain" /></View><T style={{ fontSize: 14, fontWeight: '600' }}>{mySol ? 'Your Solana · ' : ''}<T style={{ fontFamily: MONO, fontSize: 13 }}>{short(to, 5, 5)}</T></T></View> : <ActivityIndicator color={C.accent} size="small" />], ['Network', 'Solana devnet'], ['Time', 'About 1–2 min (bridge relayer)'],
      ['Bridge fee', fee === null ? (feeErr ? '—' : '…') : `${units(fee, 24, 4)} wNEAR`], ['Arrives', fee !== null && amount > fee ? `${units(amount - fee, 24, 4)} wNEAR` : '…'],
      ['On Solana now', dest === null ? '…' : `${dest.toFixed(4)} wNEAR`]]} />
    {(!!busy || res?.success) && <Steps at={done ? 3 : res?.success ? (st && st.status !== 'Initialised' ? 2 : 1) : 0} logo={LOGO.solana} items={[['Signed twice on NEAR', res?.success ? 'Both locks verified · wNEAR handed to Omni' : 'ed25519 + ML-DSA-65'], ['Bridge relaying', st ? (PLAIN[st.status] ?? `Status: ${st.status}`) : 'Omni picks it up on NEAR'], ['Arrived on Solana', done ? 'wNEAR is in your Solana address' : 'Usually a minute or two']]} />}
    {version && version !== 'magen-3' && <Err text={`This wallet runs contract ${version}. Bridging needs magen-3: create a new wallet to bridge.`} />}
    {!!feeErr && <Err text={feeErr} />}
    <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}><Atom color={C.accent} size={14} /><T style={{ color: C.text3, fontSize: 12, flex: 1, lineHeight: 17 }}>The bridge relayer and Solana are classical. What Magen guarantees: nothing leaves NEAR without your quantum-safe signature.</T></View>
  </Screen>;
}
