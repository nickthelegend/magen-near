import { ApprovalSheet } from './src/ApprovalSheet';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, AppState, Image, Linking, Modal, Pressable, Share, StyleSheet, Switch, TextInput, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import * as SecureStore from 'expo-secure-store';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import * as LocalAuthentication from 'expo-local-authentication';
import { ArrowUpRight, ArrowDownLeft, ShieldCheck, KeyRound, Atom, Check, ShieldAlert, Power, ExternalLink, ScanLine, Network, EyeOff, Repeat, Copy, Lock, Users, ArrowLeftRight, ScanFace, ChevronDown, ChevronRight, MoreHorizontal, Settings as SettingsIcon, Bell, Info as InfoIcon, Smartphone } from 'lucide-react-native';
import { chainAddresses, signCrossChain, stealthSend, stealthScan, stealthSweep, metaKey, type EthTx } from '../../sdk/phase2.ts';
import { evm } from '../../sdk/chains.ts';
import { actions, base58, base64, execute, makeIntent, nearAmount, outcome, pqHandle, publicKeys, sha256, signIntent, submit, view, type Vault } from '../../sdk/index.ts';
import { guardianPublic, newGuardian, setGuardians } from '../../sdk/guardians.ts';
import { accountUrl, ago, friendlyError, near, readAccount, readActivity, readKeys, readStatus, short, txUrl, type Activity, type KeyInfo } from '../../web/src/lib/chain.ts';
import { TabBar, ShieldSend, type Tab } from './src/TabBar';
import { ScanScreen, type ScanMode, type Sheet } from './src/ScanScreen';
import { parseScan } from './src/scan';
import { Back, Btn, Card, Err, Logo, Ok, Pill, T, Tile, feeOf, feeSigner, open, styles, type Live, type P } from './src/ui';
import { C, FONT, LOGO, MONO, TopGlow, fontAssets } from './src/theme';
import { Onboarding } from './src/Onboarding';
import { BarCtx, Screen, decimal } from './src/Screen';
import { BridgeTab, ReceiveTab, SwapTab, TxBanner, nice, retrying } from './src/Flows';
import { StripeBar, prices, units, useAssets } from './src/Assets';

const VAULT = 'magen-vault';
const CACHE = 'magen-cache';

export default function App() {
  const [fonts] = useFonts(fontAssets);
  const [vault, setVault] = useState<Vault | null | undefined>(undefined);
  const [locked, setLocked] = useState(true);
  useEffect(() => { SecureStore.getItemAsync(VAULT).then(v => setVault(v ? JSON.parse(v) : null)).catch(() => setVault(null)); }, []);
  // Leaving the app locks it; opening it again asks for Face ID (or the phone's passcode).
  // Opening an explorer link must not lock you out: lock only after a minute away.
  const away = useRef(0);
  useEffect(() => { const s = AppState.addEventListener('change', st => { if (st === 'background') away.current = Date.now(); else if (st === 'active' && away.current && Date.now() - away.current > 60_000) setLocked(true); }); return () => s.remove(); }, []);
  if (!fonts || vault === undefined) return <View style={{ flex: 1, backgroundColor: C.bg }} />;
  return <SafeAreaProvider><ApprovalSheet/><StatusBar style="light" />
    {vault ? <View style={{ flex: 1 }}><Wallet vault={vault} lock={() => setLocked(true)} onReset={async () => { await SecureStore.deleteItemAsync(VAULT); await SecureStore.deleteItemAsync(CACHE).catch(() => {}); setVault(null); }} />
      {locked && <View style={[StyleSheet.absoluteFill, { zIndex: 50, elevation: 50 }]}><LockScreen wallet={vault.wallet} onUnlock={() => setLocked(false)} /></View>}</View>
      : <Onboarding onDone={async v => { await SecureStore.setItemAsync(VAULT, JSON.stringify(v)); await SecureStore.deleteItemAsync(CACHE).catch(() => {}); setLocked(false); setVault(v); }} />}
  </SafeAreaProvider>;
}

/* ---------- lock ---------- */
function LockScreen({ wallet, onUnlock }: { wallet: string; onUnlock: () => void }) {
  const [msg, setMsg] = useState(''); const [noLock, setNoLock] = useState(false); const [busy, setBusy] = useState(false);
  const unlock = async () => {
    setMsg(''); setBusy(true);
    try {
      const [hw, enrolled, level] = await Promise.all([LocalAuthentication.hasHardwareAsync(), LocalAuthentication.isEnrolledAsync(), LocalAuthentication.getEnrolledLevelAsync()]);
      if (level === LocalAuthentication.SecurityLevel.NONE || (!hw && !enrolled)) { setNoLock(true); setMsg('This phone has no Face ID or passcode set up, so Magen cannot check it is you.'); return; }
      const r: any = await LocalAuthentication.authenticateAsync({ promptMessage: 'Unlock Magen', cancelLabel: 'Cancel' });
      if (r.success) { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); onUnlock(); return; }
      if (r.error === 'not_enrolled' || r.error === 'passcode_not_set') { setNoLock(true); setMsg('This phone has no Face ID or passcode set up, so Magen cannot check it is you.'); return; }
      setMsg(r.error === 'user_cancel' || r.error === 'system_cancel' || r.error === 'app_cancel' ? 'Still locked. Tap Unlock to try again.' : 'Face ID did not match. Try again.');
    } catch (e: any) { setNoLock(true); setMsg('Face ID is not available here: ' + String(e?.message ?? e)); } finally { setBusy(false); }
  };
  useEffect(() => { unlock(); }, []);
  return <View style={{ flex: 1, backgroundColor: C.bg }}><TopGlow height={520} /><SafeAreaView style={{ flex: 1, padding: 24 }}>
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 }}>
      <Logo size={64} />
      <T display style={{ fontSize: 30, letterSpacing: -1, textAlign: 'center' }}>Magen is locked</T>
      <T style={{ color: C.text2, fontSize: 15.5, textAlign: 'center' }}>{wallet}</T>
      {!!msg && <T style={{ color: noLock ? C.redText : C.text2, fontSize: 14, textAlign: 'center', lineHeight: 20, maxWidth: 300 }}>{msg}</T>}
    </View>
    <View style={{ gap: 10 }}>
      <Btn title={busy ? 'Checking…' : 'Unlock with Face ID'} busy={busy} onPress={unlock} icon={<ScanFace color="#fff" size={20} />} />
      {noLock && <Btn title="Open anyway (no phone lock set)" kind="ghost" onPress={onUnlock} />}
    </View>
  </SafeAreaView></View>;
}

/* ---------- wallet ---------- */
function Wallet({ vault, onReset, lock }: { vault: Vault; onReset: () => void; lock: () => void }) {
  const [tab, setTab] = useState<Tab>('home'); const [menu, setMenu] = useState(false);
  const [scanMode, setScanMode] = useState<ScanMode>('scan');
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [prefill, setPrefill] = useState<Prefill | null>(null);
  const [live, setLive] = useState<Live | null>(null);
  const [fetched, setActs] = useState<Activity[] | null>(null); const [actErr, setActErr] = useState('');
  // Transactions made in this app, kept on the phone, so history shows even while NearBlocks rate-limits.
  const [local, setLocal] = useState<Activity[]>([]);
  const LKEY = 'magen-acts-' + vault.wallet.replace(/[^a-zA-Z0-9._-]/g, '_');
  useEffect(() => { SecureStore.getItemAsync(LKEY).then(v => v && setLocal(JSON.parse(v))).catch(() => {}); }, [LKEY]);
  const addLocal = useCallback((a: Activity) => setLocal(l => { const n = [a, ...l.filter(x => x.hash !== a.hash)].slice(0, 40); SecureStore.setItemAsync(LKEY, JSON.stringify(n)).catch(() => {}); return n; }), [LKEY]);
  const acts = useMemo(() => {
    if (fetched === null && !local.length) return null;
    const seen = new Set((fetched ?? []).map(a => a.hash));
    return [...(fetched ?? []), ...local.filter(a => !seen.has(a.hash))].sort((a, b) => b.time - a.time);
  }, [fetched, local]);
  const insets = useSafeAreaInsets();
  const fade = useRef(new Animated.Value(1)).current;
  // Last known balance shows instantly on launch (no skeletons); fresh chain data replaces it in a second.
  useEffect(() => { SecureStore.getItemAsync(CACHE).then(c => { if (c && !live) { const j = JSON.parse(c); setLive({ amount: BigInt(j.amount), storage: j.storage, keys: j.keys, status: j.status }); } }).catch(() => {}); }, []);
  const refresh = useCallback(async () => {
    try {
      const [a, k, s] = await Promise.all([readAccount(vault.wallet), readKeys(vault.wallet).catch(() => []), readStatus(vault.wallet)]);
      setLive({ amount: a?.amount ?? null, storage: a?.storage ?? 0, keys: k, status: s });
      if (a) SecureStore.setItemAsync(CACHE, JSON.stringify({ amount: a.amount.toString(), storage: a.storage, keys: k.slice(0, 3), status: s ? { nonce: s.nonce, migrated: s.migrated } : null })).catch(() => {});
      retrying(() => readActivity(vault.wallet, 15), undefined, 3).then(a => { setActs(a); setActErr(''); }).catch(e => { setActErr(nice(e)); setActs(x => x ?? []); });
    } catch { /* keep the last values; the next tick retries */ }
  }, [vault.wallet]);
  useEffect(() => { refresh(); const t = setInterval(refresh, 30000); return () => clearInterval(t); }, [refresh]);
  const tabRef = useRef(tab); tabRef.current = tab;
  const go = (t: Tab) => { if (t === tabRef.current) return; if (t !== 'scan') setSheet(null); fade.setValue(0); setTab(t); Animated.timing(fade, { toValue: 1, duration: 260, useNativeDriver: true }).start(); };
  const openScan = (m: ScanMode) => { setScanMode(m); go('scan'); };
  const send = (p: Omit<Prefill, 'key'>) => { setSheet(null); setPrefill({ ...p, key: Date.now() }); go('send'); };
  /** One router for the camera, a photo, the clipboard and magen:// links. */
  const route = useCallback((raw: string) => {
    const r = parseScan(raw, vault.wallet);
    if (r.kind === 'account') return send({ to: r.account });
    if (r.kind === 'open') {
      if (r.screen === 'send') return send({ to: r.to ?? '', amount: r.amount });
      setSheet(null); return openScan(r.screen);
    }
    setSheet(r); setScanMode('scan'); go('scan');
  }, [vault.wallet]);
  // Deep links: magen://pay?…, magen://send?…, magen://receive, magen://scan (cold start and while running).
  useEffect(() => {
    Linking.getInitialURL().then(u => { if (u) route(u); }).catch(() => {});
    const sub = Linking.addEventListener('url', ({ url }) => route(url));
    return () => sub.remove();
  }, [route]);
  // Tapping Send yourself (tab bar, Home) opens a blank form; only a scan or a link prefills it.
  const goTab = (t: Tab) => { if (t === 'send') setPrefill(null); go(t); };
  const props = { vault, live, acts, actErr, refresh, go: goTab, receive: () => goTab('receive'), lock, addLocal };
  return <View style={{ flex: 1, backgroundColor: C.bg }}>
    {tab !== 'scan' && <TopGlow />}
    {/* Opaque header (own copy of the glow, same coordinates) so scrolled content never shows under it. */}
    <View style={{ paddingTop: insets.top, backgroundColor: C.bg, overflow: 'hidden', zIndex: 2 }}>
      {tab !== 'scan' && <TopGlow />}
      {tab === 'home' && <View style={[styles.top, { paddingVertical: 6, justifyContent: 'space-between' }]}>
        <Pressable onPress={() => goTab('scan')} hitSlop={8} accessibilityRole="button" accessibilityLabel="Scan" style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: C.accentSoft, alignItems: 'center', justifyContent: 'center' }}><ScanLine color={C.accentText} size={19} /></Pressable>
        <Pressable onPress={() => setMenu(true)} hitSlop={8} accessibilityRole="button" accessibilityLabel="More" style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: C.accentSoft, alignItems: 'center', justifyContent: 'center' }}><MoreHorizontal color={C.accentText} size={20} /></Pressable>
      </View>}
    </View>
    {tab !== 'scan' && <BarCtx.Provider value={!PUSHED.includes(tab)}><Animated.View style={{ flex: 1, opacity: fade, transform: [{ translateY: fade.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] }}>
      {tab === 'home' && <HomeTab {...props} />}
      {tab === 'send' && <SendTab {...props} prefill={prefill} />}
      {tab === 'activity' && <ActivityTab {...props} />}
      {tab === 'security' && <SecurityTab {...props} onReset={onReset} />}
      {tab === 'chains' && <ChainsTab {...props} />}
      {tab === 'private' && <PrivateTab {...props} />}
      {tab === 'swap' && <SwapTab {...props} />}
      {tab === 'receive' && <ReceiveTab {...props} />}
      {tab === 'bridge' && <BridgeTab {...props} />}
      {tab === 'settings' && <SettingsTab {...props} />}
    </Animated.View></BarCtx.Provider>}
    <MagicMenu open={menu} close={() => setMenu(false)} wallet={vault.wallet} go={goTab} lock={lock} top={insets.top + 52} />
    {tab === 'scan' && <Animated.View style={[StyleSheet.absoluteFill, { opacity: fade }]}>
      <ScanScreen wallet={vault.wallet} mode={scanMode} setMode={m => { setSheet(null); setScanMode(m); }} sheet={sheet} onCode={route}
        onConfirm={p => send({ to: p.to, amount: p.amount, memo: p.memo, request: true })} onDismiss={() => setSheet(null)} top={insets.top} bottom={insets.bottom} />
    </Animated.View>}
    {!PUSHED.includes(tab) && <TabBar tab={tab} onChange={t => (t === 'scan' && tab === 'scan' ? setSheet(null) : goTab(t))} bottom={insets.bottom} />}
  </View>;
}

/** The ••• popover: copy, networks, security, settings, lock. */
function MagicMenu({ open: on, close, wallet, go, lock, top }: { open: boolean; close: () => void; wallet: string; go: (t: Tab) => void; lock: () => void; top: number }) {
  const Item = ({ icon, title, onPress, right, danger }: any) => <Pressable onPress={() => { Haptics.selectionAsync(); close(); onPress(); }} accessibilityRole="button" style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, height: 46, paddingHorizontal: 14, backgroundColor: pressed ? 'rgba(255,255,255,0.06)' : 'transparent' })}>
    {icon}<T style={{ flex: 1, fontSize: 15.5, fontWeight: '600', color: danger ? C.redText : C.text }}>{title}</T>{right}</Pressable>;
  const Net = ({ logo, name, on: sel, t }: any) => <Item icon={<View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}><Image source={logo} style={{ width: 13, height: 13 }} resizeMode="contain" /></View>} title={name} onPress={() => t && go(t)} right={sel ? <Check color={C.accent} size={17} /> : null} />;
  return <Modal transparent visible={on} animationType="fade" onRequestClose={close}>
    <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' }} onPress={close} accessibilityLabel="Close menu">
      <View style={{ position: 'absolute', right: 16, top, width: 262, borderRadius: 18, backgroundColor: '#1E1F25', borderWidth: 1, borderColor: C.line2, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 24 }}>
        <Item icon={<Copy color={C.text} size={18} />} title="Copy address" onPress={() => Clipboard.setStringAsync(wallet)} />
        <View style={{ height: 1, backgroundColor: C.line }} />
        <T style={{ color: C.text3, fontSize: 12.5, fontWeight: '600', paddingHorizontal: 14, paddingTop: 10, paddingBottom: 2 }}>SWITCH NETWORK</T>
        <Net logo={LOGO.near} name="NEAR testnet" on />
        <Net logo={LOGO.ethereum} name="Ethereum Sepolia" t="chains" />
        <Net logo={LOGO.solana} name="Solana devnet" t="bridge" />
        <Net logo={LOGO.bitcoin} name="Bitcoin testnet" t="bridge" />
        <View style={{ height: 1, backgroundColor: C.line }} />
        <Item icon={<ShieldCheck color={C.text} size={18} />} title="Security" onPress={() => go('security')} />
        <Item icon={<SettingsIcon color={C.text} size={18} />} title="Settings" onPress={() => go('settings')} />
        <Item icon={<Lock color={C.redText} size={18} />} title="Lock" danger onPress={lock} />
      </View>
    </Pressable>
  </Modal>;
}

/** Settings: grouped rows with tinted icon squares. */
function SettingsTab({ vault, live, go }: P) {
  const Row = ({ icon, tint, title, value, onPress, last }: any) => <Pressable onPress={onPress} disabled={!onPress} accessibilityRole={onPress ? 'button' : undefined} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52, paddingHorizontal: 14, borderBottomWidth: last ? 0 : 1, borderBottomColor: 'rgba(255,255,255,0.06)', backgroundColor: pressed ? 'rgba(255,255,255,0.04)' : 'transparent' })}>
    <View style={{ width: 30, height: 30, borderRadius: 8, backgroundColor: tint, alignItems: 'center', justifyContent: 'center' }}>{icon}</View>
    <T style={{ flex: 1, fontSize: 16, fontWeight: '500' }}>{title}</T>{value ? <T style={{ color: C.text2, fontSize: 14 }}>{value}</T> : null}{onPress && <ChevronRight color={C.text3} size={18} />}</Pressable>;
  const G = ({ children }: any) => <View style={{ backgroundColor: C.s1, borderRadius: 16, borderWidth: 1, borderColor: C.line, overflow: 'hidden' }}>{children}</View>;
  const v = live?.status?.version ?? '…';
  return <Screen>
    <Back go={go} title="Settings" />
    <G><Row icon={<KeyRound color="#fff" size={16} />} tint={C.accent} title="Wallets & Backup" value="12 words" onPress={() => go('security')} />
      <Row icon={<ShieldCheck color="#fff" size={16} />} tint="#9C2C8A" title="Security" value="Q-Day · guardians · Face ID" onPress={() => go('security')} last /></G>
    <G><Row icon={<Network color="#fff" size={16} />} tint="#5B5F6B" title="Network" value="NEAR testnet" />
      <Row icon={<Atom color="#fff" size={16} />} tint="#5B5F6B" title="Wallet contract" value={v} />
      <Row icon={<Smartphone color="#fff" size={16} />} tint="#5B5F6B" title="App icon" value="Magen L7" last /></G>
    <G><Row icon={<InfoIcon color="#fff" size={16} />} tint="#5B5F6B" title="About" value="Magen 0.1 · testnet, not audited" last /></G>
    <T style={{ color: C.text3, fontSize: 13, textAlign: 'center' }}>{vault.wallet}</T>
  </Screen>;
}

const PUSHED: string[] = ['swap', 'send', 'chains', 'settings', 'receive', 'private'];
type Prefill = { to: string; amount?: string; memo?: string; request?: boolean; key: number };

/** "8.48" with the decimals smaller and dimmer, as on the reference's balance. */
function BigNumber({ value, unit, size = 58 }: { value: string; unit?: string; size?: number }) {
  const [int, dec] = value.split('.');
  return <T display style={{ fontSize: size, letterSpacing: -size * 0.04, lineHeight: size * 1.12, textAlign: 'center' }} numberOfLines={1} adjustsFontSizeToFit>
    {int}{dec !== undefined && <T display style={{ fontSize: size * 0.5, color: C.text3, letterSpacing: 0 }}>.{dec}</T>}
    {unit ? <T style={{ fontSize: size * 0.3, color: C.text2, letterSpacing: 0, fontWeight: '500' }}>{'  '}{unit}</T> : null}
  </T>;
}

function HomeTab({ vault, live, acts, actErr, go, receive }: P) {
  const migrated = !!live?.status?.migrated;
  const assets = useAssets(vault.wallet, live?.amount);
  const [px, setPx] = useState<Record<string, number>>({});
  const [eth, setEth] = useState<{ address: string; wei: bigint | null } | null>(null);
  const [wallets, setWallets] = useState(false);
  useEffect(() => { prices().then(setPx).catch(() => {}); }, []);
  useEffect(() => { let on = true; chainAddresses(vault.wallet).then(async (a: any[]) => { const e = a.find(x => x.id === 'ethereum'); if (!e || !on) return; setEth({ address: e.address, wei: null });
    const w = await evm('https://ethereum-sepolia-rpc.publicnode.com', 'eth_getBalance', [e.address, 'latest']).catch(() => null); on && setEth({ address: e.address, wei: w === null ? null : BigInt(w) }); }).catch(() => {}); return () => { on = false; }; }, [vault.wallet]);
  const nearPx = px.near; const usdNear = live?.amount != null && nearPx ? Number(live.amount) / 1e24 * nearPx : null;
  const SUB: Record<string, string> = { near: 'NEAR', nbtc: 'nBTC', nzec: 'nZEC', usdt: 'USDT' };
  const NAMES: Record<string, string> = { near: 'NEAR', nbtc: 'Bitcoin (nBTC)', nzec: 'Zcash (nZEC)', usdt: 'Tether USD (Ref)' };
  const order = ['near', 'usdt', 'nbtc', 'nzec'];
  const rows = order.map(id => assets.find(a => a.id === id)!).filter(Boolean);
  const usd = (n: number | null) => n === null ? null : `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return <Screen>
    <View style={{ alignItems: 'center', gap: 6, marginTop: -6 }}>
      <View style={{ width: 84, height: 84, borderRadius: 42, backgroundColor: '#3A1033', borderWidth: 2, borderColor: C.accentLine, alignItems: 'center', justifyContent: 'center', shadowColor: C.accent, shadowOpacity: 0.5, shadowRadius: 20, shadowOffset: { width: 0, height: 0 } }}><Logo size={44} /></View>
      <Pressable onPress={() => { Haptics.selectionAsync(); setWallets(true); }} accessibilityRole="button" accessibilityLabel="Switch wallet" hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 }}>
        <T style={{ fontSize: 18, fontWeight: '700' }} numberOfLines={1}>{vault.wallet}</T><ChevronDown color={C.text2} size={20} /></Pressable>
      {live ? <T display style={{ fontSize: 40, letterSpacing: -1.2 }}>{near(live.amount ?? null, 2)} <T display style={{ fontSize: 22, color: C.text2 }}>NEAR</T></T> : <ActivityIndicator color={C.accent} style={{ height: 48 }} />}
      {usdNear !== null && <T style={{ color: C.text2, fontSize: 13 }}>≈ {usd(usdNear)} at mainnet price</T>}
    </View>
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 10, marginTop: 4 }}>
      <Action label="Receive" icon={<ArrowDownLeft color="#fff" size={22} />} onPress={receive} />
      <Action label="Swap" icon={<Repeat color="#fff" size={21} />} onPress={() => go('swap')} />
      <Action label="Send" icon={<ArrowUpRight color="#fff" size={22} />} onPress={() => go('send')} />
      <Action label="Bridge" icon={<ArrowLeftRight color="#fff" size={21} />} onPress={() => go('bridge')} />
    </View>
    <View style={{ marginTop: 6 }}>
      <T style={{ fontSize: 20, fontWeight: '700', marginBottom: 4 }}>Tokens</T>
      {rows.map(a => { const zero = a.amount !== null && a.amount === 0n; const amt = a.amount === null ? '…' : units(a.amount, a.decimals, a.id === 'near' ? 4 : 6);
        const v = a.amount !== null && px[a.id] && !zero ? Number(a.amount) / 10 ** a.decimals * px[a.id] : null;
        return <TokenRow key={a.id} logo={a.logo} badge={a.id === 'near' ? null : LOGO.near} name={NAMES[a.id]} sub={`${amt} ${SUB[a.id]}`} zero={zero}
          right={zero ? <View style={{ paddingHorizontal: 12, height: 30, borderRadius: 15, borderWidth: 1, borderColor: C.accentLine, justifyContent: 'center' }}><T style={{ color: C.accentText, fontWeight: '600', fontSize: 13 }}>{a.id === 'usdt' ? 'Swap in' : 'Bridge in'}</T></View> : v !== null ? <T style={{ fontWeight: '600', fontSize: 16 }}>{usd(v)}</T> : null}
          onPress={() => go(zero ? (a.id === 'usdt' ? 'swap' : 'bridge') : 'activity')} />; })}
      <TokenRow logo={LOGO.ethereum} badge={LOGO.ethereum} name="Ether (Sepolia)" sub={eth === null || eth.wei === null ? '… ETH · NEAR MPC address' : `${units(eth.wei, 18, 5)} ETH · NEAR MPC address`} zero={eth?.wei === 0n}
        right={eth?.wei && px.eth ? <T style={{ fontWeight: '600', fontSize: 16 }}>{usd(Number(eth.wei) / 1e18 * px.eth)}</T> : null} onPress={() => go('chains')} />
      <T style={{ color: C.text3, fontSize: 13, marginTop: 6 }}>$ values use 1Click’s live mainnet prices. Testnet tokens have no market value.</T>
    </View>
    <View style={{ gap: 2 }}>
      <LinkRow icon={<Atom color={C.accent} size={18} />} title="Quantum lock" value={migrated ? 'Native ML-DSA key on' : '2 locks · ed25519 + ML-DSA-65'} onPress={() => go('security')} />
      <LinkRow icon={<EyeOff color={C.accent} size={18} />} title="Private send" value="One-time accounts" onPress={() => go('private')} />
      <LinkRow icon={<Network color={C.accent} size={18} />} title="Every chain" value="Sign via NEAR MPC" onPress={() => go('chains')} />
    </View>
    <View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}><T style={{ fontSize: 20, fontWeight: '700' }}>Activity</T><Pressable onPress={() => go('activity')} hitSlop={8}><T style={{ color: C.accentText, fontWeight: '600' }}>All</T></Pressable></View>
      {acts === null ? <ActivityIndicator color={C.accent} style={{ padding: 20 }} /> : acts.length ? acts.slice(0, 3).map(a => <ActRow key={a.hash} a={a} />) : actErr ? <ActErr text={actErr} /> : <Empty />}
    </View>
    <WalletsSheet open={wallets} close={() => setWallets(false)} wallet={vault.wallet} balance={live?.amount ?? null} />
  </Screen>;
}
const TokenRow = ({ logo, badge, name, sub, right, zero, onPress }: any) => <Pressable onPress={() => { Haptics.selectionAsync(); onPress(); }} accessibilityRole="button" accessibilityLabel={`${name}, ${sub}`}
  style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, height: 64, opacity: pressed ? 0.7 : 1 })}>
  <View style={{ width: 40, height: 40, opacity: zero ? 0.7 : 1 }}>
    <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}><Image source={logo} style={{ width: 22, height: 22 }} resizeMode="contain" /></View>
    {badge && <View style={{ position: 'absolute', left: -3, bottom: -3, width: 18, height: 18, borderRadius: 9, backgroundColor: '#fff', borderWidth: 2, borderColor: C.bg, alignItems: 'center', justifyContent: 'center' }}><Image source={badge} style={{ width: 10, height: 10 }} resizeMode="contain" /></View>}
  </View>
  <View style={{ flex: 1, minWidth: 0 }}><T style={{ fontSize: 16, fontWeight: '600', color: zero ? C.text2 : C.text }} numberOfLines={1}>{name}</T><T style={{ fontSize: 13.5, color: C.text2, marginTop: 2 }} numberOfLines={1}>{sub}</T></View>
  {right}
</Pressable>;
const LinkRow = ({ icon, title, value, onPress }: any) => <Pressable onPress={() => { Haptics.selectionAsync(); onPress(); }} accessibilityRole="button" style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, height: 56, opacity: pressed ? 0.7 : 1 })}>
  <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: C.accentSoft, alignItems: 'center', justifyContent: 'center' }}>{icon}</View>
  <T style={{ fontSize: 16, fontWeight: '600', flex: 1 }}>{title}</T><T style={{ color: C.text2, fontSize: 14 }}>{value}</T><ChevronRight color={C.text3} size={18} /></Pressable>;
function WalletsSheet({ open: on, close, wallet, balance }: { open: boolean; close: () => void; wallet: string; balance: bigint | null }) {
  const DEMO = 'magen-noam.testnet'; const [demo, setDemo] = useState<bigint | null>(null);
  useEffect(() => { if (on) readAccount(DEMO).then((a: any) => setDemo(a ? BigInt(a.amount) : null)).catch(() => {}); }, [on]);
  const W = ({ name, bal, me, note }: any) => <View style={{ width: '33%', alignItems: 'center', gap: 6, paddingVertical: 8 }}>
    <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: me ? '#3A1033' : C.s2, borderWidth: me ? 3 : 1, borderColor: me ? C.accent : C.line2, alignItems: 'center', justifyContent: 'center' }}><Logo size={34} /></View>
    <T style={{ fontWeight: '600', fontSize: 13.5 }} numberOfLines={1}>{name.replace('.testnet', '')}</T><T style={{ color: C.text2, fontSize: 13 }}>{bal === null ? '…' : `${near(bal, 2)} NEAR`}{note ? ` · ${note}` : ''}</T></View>;
  return <Modal transparent visible={on} animationType="slide" onRequestClose={close}>
    <Pressable style={{ flex: 1, backgroundColor: 'rgba(5,6,8,0.6)' }} onPress={close} accessibilityLabel="Close" />
    <View style={{ backgroundColor: C.s1, borderTopLeftRadius: 30, borderTopRightRadius: 30, borderWidth: 1, borderColor: C.line, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 44 }}>
      <View style={{ alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: C.line2, marginBottom: 14 }} />
      <T style={{ fontSize: 17, fontWeight: '700', textAlign: 'center', marginBottom: 10 }}>Wallets</T>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}><W name={wallet} bal={balance} me /><W name={DEMO} bal={demo} note="watch" /></View>
      <View style={{ alignItems: 'flex-end', marginTop: 12 }}><View style={{ paddingHorizontal: 18, height: 40, borderRadius: 20, backgroundColor: C.accent, justifyContent: 'center' }}><T style={{ fontWeight: '700' }}>+ Add</T></View></View>
    </View>
  </Modal>;
}
const Action = ({ label, icon, onPress }: { label: string; icon: any; onPress: () => void; primary?: boolean }) => <Pressable onPress={() => { Haptics.selectionAsync(); onPress(); }} accessibilityRole="button" accessibilityLabel={label} style={{ alignItems: 'center', gap: 8, width: 70 }}>
  {({ pressed }) => <><View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center', transform: [{ scale: pressed ? 0.93 : 1 }], shadowColor: C.accent, shadowOpacity: 0.4, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } }}>{icon}</View>
    <T style={{ fontSize: 14, fontWeight: '600', color: C.text }}>{label}</T></>}
</Pressable>;
const ActErr = ({ text }: { text: string }) => <View style={{ padding: 18, gap: 4 }}><T style={{ fontWeight: '600' }}>History is taking a break</T><T style={{ color: C.text3, fontSize: 13, lineHeight: 18 }}>{text} It retries every 30 seconds.</T></View>;
const LockRow = ({ icon, title, sub, ok, pq, last }: any) => <View style={[styles.row, last && { borderBottomWidth: 0 }]}>
  <View style={[styles.ico, pq && { backgroundColor: C.accentSoft }]}>{icon}</View>
  <View style={{ flex: 1 }}><T style={{ fontWeight: '600', fontSize: 15 }}>{title}</T><T style={{ color: C.text3, fontSize: 12.5, marginTop: 2 }}>{sub}</T></View>
  {ok ? <View style={styles.okDot}><Check color="#fff" size={14} strokeWidth={3} /></View> : <Pill text="Off" />}
</View>;
function ActRow({ a }: { a: Activity }) {
  const tone = a.kind === 'refused' ? [C.redSoft, C.red] : a.kind === 'received' ? [C.accentSoft, C.accent] : [C.s2, '#fff'];
  const I = a.kind === 'refused' ? ShieldAlert : a.kind === 'received' ? ArrowDownLeft : a.kind === 'sent' ? ArrowUpRight : a.kind === 'qday' ? Power : ShieldCheck;
  return <Pressable onPress={() => open(a.hash)} style={styles.row}>
    <View style={[styles.ico, { backgroundColor: tone[0] }]}><I color={tone[1]} size={18} /></View>
    <View style={{ flex: 1 }}><T style={{ fontWeight: '600', fontSize: 15 }}>{a.title}</T><T numberOfLines={1} style={{ color: C.text3, fontSize: 12.5, marginTop: 2 }}>{a.detail} · {ago(a.time)}</T></View>
    {a.amount && a.kind !== 'refused' ? <T style={{ fontWeight: '600', color: a.kind === 'received' ? C.accentText : C.text }}>{a.kind === 'received' ? '+' : '−'}{near(a.amount, 2)} <T style={{ fontSize: 12, color: C.text3 }}>NEAR</T></T> : a.kind === 'refused' ? <Pill text="Refused" tone="red" /> : <Pill text="Done" tone="green" />}
  </Pressable>;
}
const Empty = () => <View style={{ alignItems: 'center', padding: 20, gap: 6 }}><Image source={require('./assets/art/private-send.png')} style={{ width: 104, height: 104 }} /><T style={{ fontWeight: '600' }}>No activity yet</T><T style={{ color: C.text3 }}>Your first payment shows here.</T></View>;

/** Floor a yocto amount to a plain decimal string the amount field accepts. */
const nearPlain = (y: bigint, places = 4) => { const s = y.toString().padStart(25, '0'); const f = s.slice(-24).slice(0, places).replace(/0+$/, ''); return BigInt(s.slice(0, -24)).toString() + (f ? '.' + f : ''); };

function SendTab({ vault, live, refresh, go, prefill, addLocal, acts }: P & { prefill: Prefill | null }) {
  const recent = Array.from(new Set((acts ?? []).map(a => a.counterparty).filter((c): c is string => !!c && /\.testnet$/.test(c) && c !== vault.wallet))).slice(0, 3);
  const [to, setTo] = useState(prefill?.to ?? ''); const [amt, setAmt] = useState(prefill?.amount ?? '');
  const [from, setFrom] = useState<Prefill | null>(prefill);
  useEffect(() => { if (prefill && prefill.key !== from?.key) { setFrom(prefill); setTo(prefill.to); setAmt(prefill.amount ?? ''); setStage('form'); setRes(null); setErr(''); } }, [prefill?.key]);
  const [stage, setStage] = useState<'form' | 'signing' | 'sending' | 'done'>('form'); const [err, setErr] = useState('');
  const [res, setRes] = useState<{ hash: string; success: boolean; error: string } | null>(null);
  const spendable = live?.amount ? live.amount - BigInt(live.storage) * 10n ** 19n - 5n * 10n ** 23n : 0n;
  const send = async () => {
    setErr(''); setRes(null);
    try {
      const id = to.trim().toLowerCase(); const y = BigInt(nearAmount(amt.trim()));
      if (y <= 0n) throw Error('Enter an amount above zero.');
      if (y > spendable) throw Error(`You can send up to ${near(spendable > 0n ? spendable : 0n, 4)} NEAR.`);
      if (!(await readAccount(id))) throw Error(`${id} does not exist on NEAR testnet.`);
      setStage('signing');
      await new Promise(r => setTimeout(r, 60));
      const s = await view(vault.wallet);
      const signed = signIntent(makeIntent(vault.wallet, s.nonce, { kind: 'send', receiver: id, amount: y.toString() }), vault.keys);
      setStage('sending');
      const r = await execute(feeSigner(vault, live), vault.wallet, signed);
      setRes(r); setStage('done'); addLocal({ hash: r.hash, time: Date.now(), success: r.success, kind: r.success ? 'sent' : 'refused', title: r.success ? 'Sent' : 'Refused on chain', detail: r.success ? `to ${id} · signed twice` : friendlyError(r.error), amount: y.toString(), counterparty: id }); Haptics.notificationAsync(r.success ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error); refresh();
    } catch (e: any) { setErr(friendlyError(String(e.message))); setStage('form'); }
  };
  const signedYet = stage === 'sending' || stage === 'done';
  const scanned = !!from && from.to === to.trim().toLowerCase();
  const maxStr = nearPlain(spendable > 0n ? spendable : 0n);
  const frac = spendable > 0n && amt ? Math.min(1, Number(amt) / Number(maxStr)) : null;
  return <Screen notice={<>{stage === 'sending' && <TxBanner state="pending" title="Sending on NEAR testnet…" sub="Your wallet contract is checking both signatures." />}
      {res && <TxBanner state={res.success ? 'ok' : 'bad'} title={res.success ? `Sent ${amt} NEAR. NEAR verified both signatures.` : friendlyError(res.error)} links={res.success ? [['Transaction', txUrl(res.hash)], ['Recipient account', accountUrl(to.trim().toLowerCase())]] : [['View on NEAR Rocks', txUrl(res.hash)]]} />}
      {!!err && <Err text={err} />}</>}
    action={stage === 'done' ? <Btn title="New payment" kind="ghost" onPress={() => { setStage('form'); setRes(null); setAmt(''); }} />
      : <Btn title={stage === 'signing' ? 'Signing with both keys…' : stage === 'sending' ? 'NEAR is checking both…' : 'Review send'} icon={<ShieldSend size={22} />} busy={stage !== 'form'} disabled={!to || !amt} onPress={send} />}>
    <View><Back sheet go={go} title="Send" />
      {stage === 'form' && <Pressable onPress={() => go('scan')} accessibilityRole="button" accessibilityLabel="Scan a code" hitSlop={8} style={{ position: 'absolute', left: 0, top: 10, height: 40, justifyContent: 'center' }}><ScanLine color={C.text} size={21} /></Pressable>}
    </View>
    {scanned && <View style={[styles.banner, { backgroundColor: C.accentSoft, borderColor: C.accentLine, alignItems: 'center' }]}><ScanLine color={C.accent} size={18} />
      <View style={{ flex: 1 }}><T style={{ fontWeight: '600' }}>{from!.request ? 'From a Magen pay request' : 'From a scanned code'}</T>
        {!!from!.memo && <T style={{ color: C.text2, fontSize: 13, marginTop: 2 }} numberOfLines={2}>Memo: {from!.memo} (not sent on chain)</T>}</View></View>}
    <Card style={{ padding: 18, gap: 12 }}>
      <T s="label">To</T>
      <TextInput selectionColor="#E040C8" style={styles.input} placeholder="bob.testnet" placeholderTextColor={C.text3} value={to} onChangeText={t => { setTo(t); setErr(''); }} autoCapitalize="none" autoCorrect={false} editable={stage === 'form'} accessibilityLabel="Send to" />
      {stage === 'form' && recent.length > 0 && <View style={{ gap: 2 }}><T style={{ color: C.text2, fontSize: 13 }}>Recent</T>
        {recent.map(r => <Pressable key={r} onPress={() => { Haptics.selectionAsync(); setTo(r); setErr(''); }} accessibilityRole="button" style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, height: 44, opacity: pressed ? 0.7 : 1 })}>
          <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: C.accentSoft, alignItems: 'center', justifyContent: 'center' }}><T style={{ color: C.accentText, fontWeight: '700' }}>{r[0].toUpperCase()}</T></View>
          <T style={{ flex: 1, fontSize: 15, fontWeight: '600', color: to === r ? C.accentText : C.text }}>{r}</T>{to === r && <Check color={C.accent} size={16} />}</Pressable>)}</View>}
      <T s="label">Amount</T>
      <View style={{ flexDirection: 'row', alignItems: 'center', height: 64, paddingHorizontal: 4 }}>
        <TextInput selectionColor="#E040C8" style={{ flex: 1, fontFamily: FONT.display, fontSize: 44, letterSpacing: -1.5, color: C.text }} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={C.text3} value={amt} onChangeText={t => { setAmt(decimal(t)); setErr(''); }} editable={stage === 'form'} accessibilityLabel="Amount in NEAR" />
        <T style={{ color: C.text2, fontSize: 17, fontWeight: '600' }}>NEAR</T>
      </View>
      <StripeBar pct={frac} logo={LOGO.near} label={frac !== null && frac >= 0.995 ? 'Max' : `${amt || '0'} of ${near(spendable > 0n ? spendable : 0n, 2)} NEAR`}
        onPress={stage === 'form' && spendable > 0n ? () => setAmt(maxStr) : undefined} a11y={`Use the maximum, ${maxStr} NEAR`} />
      <T style={{ color: C.text3, fontSize: 13 }}>Available {near(spendable > 0n ? spendable : 0n, 4)} NEAR · tap the bar for Max</T>
    </Card>
    <Card style={{ padding: 16, gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><ShieldCheck color={C.accent} size={17} /><T style={{ fontWeight: '600', fontSize: 15 }}>Signed twice on this phone</T></View>
      <SigRow icon={<KeyRound color={C.text} size={16} />} title="ed25519" sub={signedYet ? '64 bytes · signed' : stage === 'signing' ? 'signing…' : 'classical'} done={signedYet} />
      <SigRow pq icon={<Atom color={C.accent} size={16} />} title="ML-DSA-65" sub={signedYet ? '3,309 bytes · signed' : stage === 'signing' ? 'signing…' : 'post-quantum'} done={signedYet} />
    </Card>
    {stage === 'done' && res?.success && <Pressable onPress={() => go('activity')} hitSlop={8}><T style={{ color: C.accentText, fontWeight: '600', textAlign: 'center' }}>See it in Activity</T></Pressable>}
  </Screen>;
}
const SigRow = ({ icon, title, sub, done, pq }: any) => <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, paddingRight: 14, borderRadius: 999, backgroundColor: C.s2 }}>
  <View style={[styles.ico, { width: 36, height: 36, backgroundColor: pq ? C.accentSoft : 'rgba(255,255,255,0.08)' }]}>{icon}</View>
  <View style={{ flex: 1 }}><T style={{ fontWeight: '600' }}>{title}</T><T style={{ color: C.text2, fontSize: 12.5 }}>{sub}</T></View>
  {done && <View style={styles.okDot}><Check color="#fff" size={14} strokeWidth={3} /></View>}
</View>;

function ActivityTab({ acts, actErr, refresh }: P) {
  return <Screen><T s="h1">Activity</T><Card>{acts === null ? <ActivityIndicator color={C.accent} style={{ padding: 24 }} /> : acts.length ? acts.map(a => <ActRow key={a.hash} a={a} />) : actErr ? <ActErr text={actErr} /> : <Empty />}</Card>
    {acts !== null && <Pressable onPress={refresh} hitSlop={8}><T style={{ color: C.accentText, fontWeight: '600' }}>Refresh</T></Pressable>}
    <T style={{ color: C.text3, fontSize: 12.5, lineHeight: 18 }}>Everything you do in this app is listed here, plus the account history from NearBlocks when it answers. Tap a row to open it on NEAR Rocks, the testnet explorer.</T></Screen>;
}

function SecurityTab({ vault, live, refresh, onReset, lock, addLocal }: P & { onReset: () => void }) {
  const on = !!live?.status?.migrated;
  const [busy, setBusy] = useState(''); const [res, setRes] = useState<{ hash: string; success: boolean; error: string } | null>(null);
  const handle = useMemo(() => pqHandle(publicKeys(vault.keys).pq), [vault]);
  const edKey = live?.keys.find(k => k.scheme === 'ed25519');
  const dropClassical = () => Alert.alert('Remove the classical key?', 'Your ML-DSA-65 key signs this itself. After it, NEAR lists only post-quantum keys for this account.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Remove', style: 'destructive', onPress: async () => {
      try {
        setBusy('Signing with ML-DSA-65 only…'); await new Promise(r => setTimeout(r, 60));
        const r = outcome(await submit({ account: vault.wallet, seed: vault.keys.pq, pq: true }, vault.wallet, [actions.deleteKey(base58.decode(edKey!.publicKey.slice(8)))]));
        setRes(r); addLocal({ hash: r.hash, time: Date.now(), success: r.success, kind: r.success ? 'qday' : 'refused', title: 'Classical key removed', detail: 'Signed with ML-DSA-65 only' }); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); setTimeout(refresh, 2500);
      } catch (e: any) { setRes({ hash: '', success: false, error: String(e.message) }); } finally { setBusy(''); }
    } }]);
  const flip = () => Alert.alert('Turn on the Q-Day switch?', 'Your ML-DSA-65 key becomes a native NEAR full-access key. After this, it alone controls the account at the protocol level.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Turn on', onPress: async () => {
      try {
        setBusy('Signing with both keys…'); await new Promise(r => setTimeout(r, 60));
        const s = await view(vault.wallet);
        const signed = signIntent(makeIntent(vault.wallet, s.nonce, { kind: 'migrate' }), vault.keys);
        setBusy('Adding the native key on NEAR…');
        const r = await execute(feeSigner(vault, live), vault.wallet, signed); setRes(r);
        addLocal({ hash: r.hash, time: Date.now(), success: r.success, kind: r.success ? 'qday' : 'refused', title: 'Q-Day switch', detail: r.success ? 'Native ML-DSA-65 key added · signed twice' : friendlyError(r.error) });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setTimeout(refresh, 2500);
      } catch (e: any) { setRes({ hash: '', success: false, error: String(e.message) }); } finally { setBusy(''); }
    } }]);
  return <Screen>
    <T s="h1">Security</T>
    <Card style={{ padding: 20, gap: 12 }}>
      <Image source={require('./assets/art/quantum-lock.png')} style={{ position: 'absolute', right: -8, top: 4, width: 120, height: 120 }} />
      <Pill tone={on ? 'blue' : 'gray'} text={on ? 'Switched on' : 'Off'} />
      <T display style={{ fontSize: 24, letterSpacing: -0.6, maxWidth: 220 }}>{on ? 'Your post-quantum key is native on NEAR.' : 'Q-Day switch'}</T>
      <T style={{ color: C.text2, fontSize: 14.5, lineHeight: 21, maxWidth: 240 }}>{on ? 'NEAR lists your ML-DSA-65 key in the account’s access keys.' : 'For the day quantum computers can break today’s keys ("Q-Day"): one switch makes your quantum-safe key a native NEAR key. Same account, same balance.'}</T>
      <Pressable onPress={() => !on && !busy && flip()} disabled={on || !!busy} accessibilityRole="switch" accessibilityState={{ checked: on }} accessibilityLabel="Q-Day switch" style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 12, paddingLeft: 14, borderRadius: 999, backgroundColor: C.s2 }}>
        <Switch pointerEvents="none" value={on} disabled={on || !!busy} trackColor={{ true: C.accent, false: C.s3 }} thumbColor="#fff" ios_backgroundColor={C.s3} />
        <View style={{ flex: 1 }}><T style={{ fontWeight: '600' }}>{on ? 'Native ML-DSA-65 key: on' : 'Add native ML-DSA-65 key'}</T><T style={{ color: C.text2, fontSize: 12.5 }}>{busy || 'Signed with both locks'}</T></View>
        {!!busy && <ActivityIndicator color="#fff" />}
      </Pressable>
      {!on && <Btn title={busy || 'Turn on the Q-Day switch'} busy={!!busy} onPress={flip} icon={<Power color="#fff" size={18} />} />}
      {res?.hash ? <TxBanner state={res.success ? 'ok' : 'bad'} title={res.success ? (on ? 'Switched on. NEAR checked both signatures.' : 'Done. NEAR checked the signature.') : friendlyError(res.error)} links={[['View on NEAR Rocks', txUrl(res.hash)]]} />
        : res && !res.success ? <Err text={nice({ message: res.error })} /> : null}
      {on && edKey && <Btn title={busy ? busy : 'Remove the classical key'} kind="ghost" busy={!!busy} onPress={dropClassical} />}
      {on && live && !edKey && <T style={{ color: C.accentText, fontSize: 13.5 }}>Only post-quantum keys remain on this account.</T>}
    </Card>
    <Guardians vault={vault} live={live} refresh={refresh} addLocal={addLocal} />
    <Card>
      <View style={styles.cardHead}><T style={styles.h2}>What NEAR sees</T><Pressable onPress={() => Linking.openURL(`https://testnet.near.rocks/account/${vault.wallet}`)} hitSlop={8}><ExternalLink color={C.accent} size={18} /></Pressable></View>
      {(live?.keys ?? []).map((k, i, a) => <View key={k.publicKey} style={[styles.row, i === a.length - 1 && { borderBottomWidth: 0 }]}>
        <View style={[styles.ico, k.scheme === 'ML-DSA-65' && { backgroundColor: C.accentSoft }]}>{k.scheme === 'ML-DSA-65' ? <Atom color={C.accent} size={18} /> : <KeyRound color={C.text2} size={18} />}</View>
        <View style={{ flex: 1 }}><T style={{ fontWeight: '600' }}>{k.scheme} · {k.full ? 'full access' : 'execute only'}</T><T numberOfLines={1} style={{ color: C.text3, fontSize: 12, fontFamily: MONO }}>{k.publicKey}</T></View>
      </View>)}
      {!on && <View style={[styles.row, { borderBottomWidth: 0 }]}><T style={{ color: C.text3, fontSize: 12.5, flex: 1 }}>After the switch: {short(handle, 22, 6)}</T></View>}
    </Card>
    <Btn title="Lock Magen now" kind="dark" onPress={lock} icon={<Lock color="#fff" size={17} />} />
    <Btn title="Remove wallet from this phone" kind="light" onPress={() => Alert.alert('Remove wallet?', vault.mnemonic ? 'Keys are deleted from this phone. You can restore with your 12 words.' : 'Keys are deleted from this phone. Without another copy of both keys you lose access.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Remove', style: 'destructive', onPress: onReset }])} />
  </Screen>;
}

const GKITS = 'magen-guardian-kits';
const gkey = (w: string) => GKITS + '-' + w.replace(/[^a-zA-Z0-9._-]/g, '_');
/** Guardians (magen-2+): three ML-DSA-65 keys made on this phone; two of three can move both locks to a new phone. They can never spend. */
function Guardians({ vault, live, refresh, addLocal }: { vault: Vault; live: Live | null; refresh: () => void; addLocal: P['addLocal'] }) {
  const [busy, setBusy] = useState(''); const [err, setErr] = useState(''); const [hash, setHash] = useState('');
  const [kits, setKits] = useState<{ name: string; seed: string }[] | null>(null);
  useEffect(() => { SecureStore.getItemAsync(gkey(vault.wallet)).then(k => setKits(k ? JSON.parse(k) : null)).catch(() => {}); }, [vault.wallet]);
  const st = live?.status;
  const v2 = st?.version === 'magen-2' || st?.version === 'magen-3';
  const setup = async () => {
    setErr(''); setHash('');
    try {
      setBusy('Making three guardian keys…'); await new Promise(r => setTimeout(r, 60));
      const gs = ['Guardian 1', 'Guardian 2', 'Guardian 3'].map(newGuardian);
      const pubs = gs.map(guardianPublic);
      // Keep the kits before anything is sent, so guardians on chain always have their keys on this phone.
      const prev = await SecureStore.getItemAsync(gkey(vault.wallet)).catch(() => null);
      await SecureStore.setItemAsync(gkey(vault.wallet), JSON.stringify(gs));
      setBusy('Signing with both keys…');
      const s = await view(vault.wallet);
      const r = await execute(feeSigner(vault, live), vault.wallet, signIntent(makeIntent(vault.wallet, s.nonce, setGuardians(pubs, 2)), vault.keys));
      setHash(r.hash);
      addLocal({ hash: r.hash, time: Date.now(), success: r.success, kind: r.success ? 'upgrade' : 'refused', title: 'Guardians set', detail: r.success ? '2 of 3 ML-DSA-65 guardians · signed twice' : friendlyError(r.error) });
      if (!r.success) { if (prev) await SecureStore.setItemAsync(gkey(vault.wallet), prev).catch(() => {}); else await SecureStore.deleteItemAsync(gkey(vault.wallet)).catch(() => {}); throw Error(r.error); }
      setKits(gs);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); setTimeout(refresh, 2500);
    } catch (e: any) { setErr(nice(e)); } finally { setBusy(''); }
  };
  const share = (i: number) => kits && Share.share({ message: JSON.stringify({ kind: 'magen-guardian-kit', wallet: vault.wallet, index: i, name: kits[i].name, seed: kits[i].seed, note: 'Keep this safe. Two of three guardians can restore this Magen wallet. A guardian can never spend.' }) }).catch(() => {});
  const fp = (b64: string) => base58.encode(sha256(base64.decode(b64))).slice(0, 10);
  return <Card style={{ padding: 18, gap: 12 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Users color={C.accent} size={18} /><T style={styles.h2}>Guardians</T></View>
      <Pill tone={st?.threshold ? 'blue' : 'gray'} text={st?.threshold ? `${st.threshold} of ${st.guardians?.length}` : 'Not set'} />
    </View>
    <T style={{ color: C.text2, fontSize: 14, lineHeight: 20 }}>Lose this phone and two of three people you trust can move both locks to a new one. Each guardian holds a quantum-safe key, checked on chain. Guardians can never spend your money.</T>
    {!st ? <ActivityIndicator color={C.accent} /> : st.threshold ? <>
      {st.guardians!.map((g: string, i: number) => <View key={g} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={[styles.ico, { width: 34, height: 34, backgroundColor: C.accentSoft }]}><Atom color={C.accent} size={16} /></View>
        <View style={{ flex: 1 }}><T style={{ fontWeight: '600' }}>Guardian {i + 1}</T><T style={{ color: C.text3, fontSize: 12, fontFamily: MONO }}>ML-DSA-65 · {fp(g)}…</T></View>
        {kits?.[i] ? <Pressable onPress={() => share(i)} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Share guardian ${i + 1} kit`}><T style={{ color: C.accentText, fontWeight: '600' }}>Share kit</T></Pressable> : <Pill text="can't spend" />}
      </View>)}
      {kits ? <T style={{ color: C.text3, fontSize: 12.5, lineHeight: 18 }}>Send each kit to a different person. Until you do, the kits stay in this phone's keychain.</T>
        : <><T style={{ color: C.text3, fontSize: 12.5, lineHeight: 18 }}>The guardian kits are not on this phone. Make a new set to hand out; the old guardians stop counting.</T>
          <Btn title={busy || 'Replace with 3 new guardians'} busy={!!busy} kind="dark" onPress={setup} icon={<Users color="#fff" size={17} />} /></>}
    </> : !v2 ? <T style={{ color: C.text3, fontSize: 13 }}>This account runs wallet contract {st.version ?? 'magen-1'}. Guardians need magen-2 or later.</T>
      : <Btn title={busy || 'Set up 2-of-3 guardians'} busy={!!busy} kind="dark" onPress={setup} icon={<Users color="#fff" size={17} />} />}
    {!!busy && <TxBanner state="pending" title="Saving your guardians on NEAR…" sub="One transaction, signed with both keys." />}
    {!!hash && !busy && <TxBanner state={err ? 'bad' : 'ok'} title={err ? 'Guardians were not set.' : 'Guardians set. NEAR checked both signatures.'} sub={err ? undefined : 'Share each kit with a different person you trust.'} links={[['View on NEAR Rocks', txUrl(hash)]]} />}
    {!!err && <Err text={err} />}
  </Card>;
}

/* ---------- phase 2: every chain, private send, swap ---------- */
const SEPOLIA = 'https://ethereum-sepolia-rpc.publicnode.com';
const weiOf = (v: string) => { const [i, f = ''] = v.trim().split('.'); if (!/^\d*$/.test(i) || !/^\d*$/.test(f) || f.length > 18 || !(i || f)) throw Error('Enter an ETH amount like 0.001.'); return BigInt(i || '0') * 10n ** 18n + BigInt((f + '0'.repeat(18)).slice(0, 18)); };
const ethStr = (w: bigint, p = 4) => { const s = w.toString().padStart(19, '0'); const f = s.slice(-18).slice(0, p).replace(/0+$/, ''); return BigInt(s.slice(0, -18)).toString() + (f ? '.' + f : ''); };
type EthStage = 'form' | 'near' | 'mpc' | 'sepolia' | 'done';
function ChainsTab({ vault, live, go, addLocal }: P) {
  const [addrs, setAddrs] = useState<any[] | null>(null); const [err, setErr] = useState('');
  const [bal, setBal] = useState<bigint | null>(null); const [to, setTo] = useState(''); const [amt, setAmt] = useState('0.001');
  const [stage, setStage] = useState<EthStage>('form'); const [res, setRes] = useState<any>(null); const [refusal, setRefusal] = useState<any>(null);
  useEffect(() => { chainAddresses(vault.wallet).then(setAddrs).catch(e => setErr(friendlyError(String(e.message)))); }, [vault.wallet]);
  const eth = addrs?.find(a => a.id === 'ethereum');
  const loadBal = useCallback(() => { if (eth) evm(SEPOLIA, 'eth_getBalance', [eth.address, 'latest']).then((b: string) => setBal(BigInt(b))).catch(() => setBal(null)); }, [eth?.address]);
  useEffect(() => { loadBal(); }, [loadBal]);
  const send = async () => {
    if (!eth) return; setErr(''); setRes(null); setRefusal(null);
    try {
      const dest = to.trim(); if (!/^0x[0-9a-fA-F]{40}$/.test(dest)) throw Error('Enter an Ethereum address: 0x followed by 40 hex characters.');
      const value = weiOf(amt); if (value <= 0n) throw Error('Enter an amount above zero.');
      const [nonce, gp, b] = await Promise.all([evm(SEPOLIA, 'eth_getTransactionCount', [eth.address, 'latest']), evm(SEPOLIA, 'eth_gasPrice', []), evm(SEPOLIA, 'eth_getBalance', [eth.address, 'latest'])]);
      const tx: EthTx = { chainId: 11155111n, nonce: BigInt(nonce), maxPriorityFeePerGas: 1_000_000_000n, maxFeePerGas: BigInt(gp) * 2n + 1_000_000_000n, gas: 21000n, to: dest, value };
      if (BigInt(b) < value + tx.gas * tx.maxFeePerGas) throw Error(`Your Ethereum address holds ${ethStr(BigInt(b), 5)} Sepolia ETH, not enough for ${amt} ETH plus gas.`);
      setStage('near'); await new Promise(r => setTimeout(r, 60));
      const r = await signCrossChain(feeOf(vault, live), vault.wallet, vault.keys, { chain: 'ethereum', tx, from: eth.address });
      if (!r.success || !r.raw) { setRes(r); setStage('form'); throw Error(r.error ? friendlyError(r.error) : 'NEAR returned no MPC signature.'); }
      setStage('mpc'); setRes({ near: r.hash }); await new Promise(r2 => setTimeout(r2, 400));
      setStage('sepolia');
      const h: string = await evm(SEPOLIA, 'eth_sendRawTransaction', [r.raw]);
      setRes({ near: r.hash, eth: h });
      let rc: any = null; for (let i = 0; i < 60 && !rc; i++) { rc = await evm(SEPOLIA, 'eth_getTransactionReceipt', [h]); if (!rc) await new Promise(r2 => setTimeout(r2, 2000)); }
      if (!rc) throw Error(`Broadcast ${short(h)}, but Sepolia has not mined it after two minutes.`);
      if (rc.status !== '0x1') throw Error(`Sepolia reverted ${short(h)}.`);
      setRes({ near: r.hash, eth: h, block: parseInt(rc.blockNumber, 16) }); setStage('done'); loadBal();
      addLocal({ hash: r.hash, time: Date.now(), success: true, kind: 'sent', title: 'Sent on Ethereum Sepolia', detail: `${amt} ETH · MPC signed after both locks`, counterparty: dest });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) { setErr(friendlyError(String(e.message))); setStage(s => (s === 'done' ? s : 'form')); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); }
  };
  const tryOne = async () => {
    if (!eth) return; setErr(''); setRefusal(null);
    try {
      const tx: EthTx = { chainId: 11155111n, nonce: 0n, maxPriorityFeePerGas: 1n, maxFeePerGas: 1n, gas: 21000n, to: eth.address, value: 1n };
      setRefusal({ busy: true }); const r = await signCrossChain(feeOf(vault, live), vault.wallet, vault.keys, { chain: 'ethereum', tx, from: eth.address }, { dropPq: true }); setRefusal(r);
    } catch (e: any) { setRefusal(null); setErr(friendlyError(String(e.message))); }
  };
  const busy = stage !== 'form' && stage !== 'done';
  const steps: [EthStage, string, string][] = [['near', 'Signed twice on NEAR', 'Your wallet contract checks ed25519 + ML-DSA-65'], ['mpc', 'MPC signature', 'v1.signer-prod.testnet signs for your address'], ['sepolia', 'Sent on Sepolia', res?.block ? `Mined in block ${res.block.toLocaleString('en-US')}` : 'Broadcast and mined on Ethereum Sepolia']];
  const order: EthStage[] = ['form', 'near', 'mpc', 'sepolia', 'done']; const at = order.indexOf(stage);
  return <Screen tall notice={<>{stage === 'done' && res?.eth && <TxBanner state="ok" title={`Sent ${amt} ETH on Sepolia.`} sub="NEAR checked both your signatures before its MPC signed." links={[['NEAR request', txUrl(res.near)], ['Etherscan', `https://sepolia.etherscan.io/tx/${res.eth}`]]} />}
      {!!err && <Err text={err} />}</>}
    action={stage === 'done' ? <Btn title="New transfer" kind="ghost" onPress={() => { setStage('form'); setRes(null); }} />
      : <Btn title={stage === 'near' ? 'NEAR is checking both…' : stage === 'mpc' ? 'MPC is signing…' : stage === 'sepolia' ? 'Waiting for Sepolia…' : 'Sign twice and send'} icon={<ShieldSend size={22} />} busy={busy} disabled={!eth || !to || !amt || busy} onPress={send} />}>
    <Back sheet go={go} title="Send on Ethereum" />
    <Card style={{ padding: 16, gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={[styles.ico, { backgroundColor: '#fff' }]}><Image source={LOGO.ethereum} style={{ width: 22, height: 22 }} resizeMode="contain" /></View>
        <View style={{ flex: 1, minWidth: 0 }}><T style={{ fontWeight: '600', fontSize: 15 }}>Ethereum <T style={{ color: C.text3, fontSize: 12.5 }}>Sepolia</T></T>
          {eth ? <T numberOfLines={1} style={{ color: C.text2, fontSize: 12.5, fontFamily: MONO }}>{short(eth.address, 8, 6)}</T> : <ActivityIndicator color={C.accent} />}</View>
        <View style={{ alignItems: 'flex-end' }}><T display style={{ fontSize: 24, letterSpacing: -0.6 }}>{bal === null ? '…' : ethStr(bal, 5)}</T><T style={{ color: C.text3, fontSize: 12 }}>ETH</T></View>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><Atom color={C.accent} size={13} /><T style={{ color: C.accentText, fontSize: 12, fontWeight: '600', flex: 1 }}>Your Ethereum address from NEAR Chain Signatures</T>
        {eth && <Pressable onPress={() => Clipboard.setStringAsync(eth.address)} hitSlop={8} accessibilityLabel="Copy Ethereum address"><Copy color={C.text3} size={16} /></Pressable>}</View>
    </Card>
    <Card style={{ padding: 18, gap: 12 }}>
      <T s="label">To</T>
      <TextInput selectionColor="#E040C8" style={[styles.input, { fontFamily: MONO, fontSize: 14 }]} placeholder="0x…" placeholderTextColor={C.text3} value={to} onChangeText={t => { setTo(t); setErr(''); }} autoCapitalize="none" autoCorrect={false} editable={stage === 'form'} accessibilityLabel="Ethereum address to send to" />
      <T s="label">Amount</T>
      <View style={{ flexDirection: 'row', alignItems: 'center', height: 60, paddingHorizontal: 4 }}>
        <TextInput selectionColor="#E040C8" style={{ flex: 1, fontFamily: FONT.display, fontSize: 40, letterSpacing: -1.5, color: C.text }} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={C.text3} value={amt} onChangeText={t => { setAmt(decimal(t)); setErr(''); }} editable={stage === 'form'} accessibilityLabel="Amount in Sepolia ETH" />
        <T style={{ color: C.text2, fontSize: 17, fontWeight: '600' }}>ETH</T>
      </View>
    </Card>
    {(busy || stage === 'done') && <Card style={{ padding: 18, gap: 14 }}>
      <StripeBar pct={stage === 'done' ? 1 : Math.max(0.12, (at - 0.5) / 3)} logo={LOGO.ethereum} label={stage === 'done' ? 'Done' : steps[Math.max(0, at - 1)][1] + '…'} />
      {steps.map(([k, t, sub], i) => { const done = at > i + 1 || stage === 'done'; const now = at === i + 1 && stage !== 'done';
        return <View key={k} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={[styles.ico, { width: 32, height: 32, backgroundColor: done ? C.accent : C.s2 }]}>{done ? <Check color="#fff" size={15} strokeWidth={3} /> : now ? <ActivityIndicator color={C.accent} size="small" /> : <T style={{ color: C.text3, fontWeight: '700' }}>{i + 1}</T>}</View>
          <View style={{ flex: 1 }}><T style={{ fontWeight: '600', color: done || now ? C.text : C.text3 }}>{t}</T><T style={{ color: C.text3, fontSize: 12.5 }}>{sub}</T></View>
        </View>; })}
    </Card>}
    <Card style={{ padding: 16, gap: 10 }}>
      <T style={{ fontWeight: '600', fontSize: 15 }}>Every chain, one quantum gate</T>
      {addrs === null ? <ActivityIndicator color={C.accent} /> : addrs.map(a => <View key={a.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={[styles.ico, { width: 30, height: 30, backgroundColor: '#fff' }]}>{LOGO[a.id] ? <Image source={LOGO[a.id]} style={{ width: 18, height: 18 }} resizeMode="contain" /> : <T style={{ color: C.bg, fontWeight: '700' }}>{a.name.slice(0, 1)}</T>}</View>
        <T style={{ fontWeight: '600', width: 92 }}>{a.name}</T><T numberOfLines={1} style={{ flex: 1, color: C.text3, fontSize: 12, fontFamily: MONO }}>{short(a.address, 8, 6)}</T>
      </View>)}
      <Pressable onPress={tryOne} disabled={!eth || !!refusal?.busy || busy} hitSlop={6} accessibilityRole="button"><T style={{ color: C.accentText, fontWeight: '600' }}>{refusal?.busy ? 'Asking with one signature…' : 'Try asking with the classical signature only'}</T></Pressable>
      {refusal && !refusal.busy && <TxBanner state={refusal.success ? 'ok' : 'bad'} title={refusal.success ? 'Unexpected: signed with one signature' : 'Refused on NEAR: quantum half missing'} sub={refusal.success ? undefined : 'NEAR never asked the MPC, so nothing was signed.'} links={[['View refusal', txUrl(refusal.hash)]]} />}
    </Card>
  </Screen>;
}

function PrivateTab({ vault, live, go, refresh, addLocal }: P) {
  const [mode, setMode] = useState<'send' | 'receive'>('send');
  const [meta, setMeta] = useState(''); const [amt, setAmt] = useState('0.1'); const [busy, setBusy] = useState(''); const [err, setErr] = useState('');
  const [sent, setSent] = useState<any>(null); const [note, setNote] = useState(''); const [opened, setOpened] = useState<any>(null); const [dest, setDest] = useState(''); const [swept, setSwept] = useState<any>(null);
  const [copied, setCopied] = useState('');
  const mine = useMemo(() => metaKey(vault.keys), [vault]);
  const copy = (t: string, what: string) => { Clipboard.setStringAsync(t); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); setCopied(what); setTimeout(() => setCopied(''), 1600); };
  const run = async (fn: () => Promise<void>) => { setErr(''); try { await fn(); } catch (e: any) { setErr(nice(e)); } finally { setBusy(''); } };
  const send = () => run(async () => {
    setSent(null); setBusy('Signing twice…'); await new Promise(r => setTimeout(r, 60));
    const r = await stealthSend(feeOf(vault, live), vault.wallet, vault.keys, meta.trim(), amt); setSent(r);
    addLocal({ hash: r.hash, time: Date.now(), success: r.success, kind: r.success ? 'sent' : 'refused', title: 'Sent privately', detail: r.success ? 'to a one-time account · signed twice' : friendlyError(r.error), amount: nearAmount(amt) }); refresh();
  });
  const openNote = () => run(async () => { setSwept(null); setBusy('Opening the note…'); setOpened(await retrying(() => stealthScan(vault.keys, note.trim()))); });
  const spend = () => run(async () => {
    setBusy('Spending…'); const to = dest.trim().toLowerCase(); const w = await stealthSweep(opened, to); setSwept(w);
    addLocal({ hash: w.hash, time: Date.now(), success: w.success, kind: 'received', title: 'Received privately', detail: `one-time account → ${to}`, amount: opened.balance?.toString() });
    if (w.success) setOpened(null); refresh();
  });
  const notice = <>
    {mode === 'send' && sent && (sent.success ? <TxBanner state="ok" title={`Sent ${amt} NEAR to a one-time account.`} sub="Now give the recipient the payment note. Only they can open it." links={[['Transaction', txUrl(sent.hash)], ['One-time account', accountUrl(sent.account)]]} />
      : <TxBanner state="bad" title={friendlyError(sent.error)} links={[['View the transaction', txUrl(sent.hash)]]} />)}
    {mode === 'receive' && swept && <TxBanner state={swept.success ? 'ok' : 'bad'} title={swept.success ? `Received. The money is now in ${dest.trim().toLowerCase()}.` : 'Spending failed.'} links={[['View on NEAR Rocks', txUrl(swept.hash)]]} />}
    {!!err && <Err text={err} />}
  </>;
  const action = mode === 'send'
    ? (sent?.success ? <View style={{ flexDirection: 'row', gap: 10 }}><View style={{ flex: 1.4 }}><Btn title={copied === 'note' ? 'Note copied' : 'Copy the note'} onPress={() => copy(sent.note, 'note')} icon={<Copy color="#fff" size={17} />} /></View><View style={{ flex: 1 }}><Btn title="New" kind="ghost" onPress={() => { setSent(null); setMeta(''); }} /></View></View>
      : <Btn title={busy || 'Sign twice and send privately'} busy={!!busy} disabled={!meta || !amt} icon={<ShieldSend size={20} />} onPress={send} />)
    : opened?.balance != null ? <Btn title={busy || 'Move it to an account'} busy={!!busy} disabled={!dest} onPress={spend} />
    : <Btn title={busy || 'Open the note'} busy={!!busy} disabled={!note} onPress={openNote} />;
  return <Screen notice={notice} action={action}>
    <Back go={go} title="Private send" sub="The money goes to a one-time account that only the recipient can open, so nobody can tell it is theirs. Still public: your account, the amount and the time." />
    <View style={styles.seg}>{(['send', 'receive'] as const).map(m => <Pressable key={m} onPress={() => { setMode(m); setErr(''); }} style={[styles.segBtn, mode === m && styles.segOn]} accessibilityRole="tab"><T style={{ fontWeight: '600', color: mode === m ? C.text : C.text3 }}>{m === 'send' ? 'Send privately' : 'Receive privately'}</T></Pressable>)}</View>
    {mode === 'send' ? <Card style={{ padding: 18, gap: 10 }}>
      <T s="label">Recipient's private code</T>
      <View style={{ flexDirection: 'row', gap: 8 }}><TextInput selectionColor="#E040C8" style={[styles.input, { flex: 1 }]} placeholder="magen-meta:…" placeholderTextColor={C.text3} value={meta} onChangeText={t => { setMeta(t); setErr(''); setSent(null); }} autoCapitalize="none" autoCorrect={false} accessibilityLabel="Recipient's private code" />
        <Pressable onPress={async () => { setMeta((await Clipboard.getStringAsync()).trim()); setErr(''); }} style={[styles.input, { width: 80, alignItems: 'center', justifyContent: 'center' }]} accessibilityRole="button"><T style={{ color: C.accentText, fontWeight: '600' }}>Paste</T></Pressable></View>
      <T style={{ color: C.text3, fontSize: 12.5, lineHeight: 18 }}>Ask them for it: it starts with magen-meta: and is under Receive privately in their Magen app (its "meta-key").</T>
      <T s="label">Amount (NEAR)</T>
      <TextInput selectionColor="#E040C8" style={styles.input} keyboardType="decimal-pad" value={amt} onChangeText={t => { setAmt(decimal(t)); setErr(''); }} accessibilityLabel="Amount in NEAR" />
      {sent?.success && <Pressable onPress={() => copy(sent.note, 'note')} style={[styles.input, { justifyContent: 'center' }]}><T numberOfLines={1} style={{ fontFamily: MONO, fontSize: 12 }}>{short(sent.note, 22, 6)}</T></Pressable>}
    </Card> : <Card style={{ padding: 18, gap: 10 }}>
      <T s="label">Your private code (safe to share)</T>
      <Pressable onPress={() => copy(mine, 'mine')} style={[styles.input, { flexDirection: 'row', alignItems: 'center', gap: 8 }]} accessibilityRole="button" accessibilityLabel="Copy your private code">
        <T numberOfLines={1} style={{ fontFamily: MONO, fontSize: 12.5, flex: 1 }}>{short(mine, 22, 6)}</T>{copied === 'mine' ? <Check color={C.accent} size={16} /> : <Copy color={C.text3} size={16} />}</Pressable>
      <T style={{ color: C.text3, fontSize: 12.5, lineHeight: 18 }}>{copied === 'mine' ? 'Copied. Send it to whoever pays you.' : 'Tap to copy. Payers use it to send to you privately.'}</T>
      <T s="label">Payment note you received</T>
      <View style={{ flexDirection: 'row', gap: 8 }}><TextInput selectionColor="#E040C8" style={[styles.input, { flex: 1 }]} placeholder="magen-note:…" placeholderTextColor={C.text3} value={note} onChangeText={t => { setNote(t); setOpened(null); setErr(''); }} autoCapitalize="none" autoCorrect={false} accessibilityLabel="Payment note" />
        <Pressable onPress={async () => { setNote((await Clipboard.getStringAsync()).trim()); setOpened(null); }} style={[styles.input, { width: 80, alignItems: 'center', justifyContent: 'center' }]} accessibilityRole="button"><T style={{ color: C.accentText, fontWeight: '600' }}>Paste</T></Pressable></View>
      {opened && <T style={{ color: C.text2, lineHeight: 20 }}>{opened.balance === null ? 'This one-time account is empty or was already spent.' : `${near(opened.balance, 4)} NEAR is waiting in one-time account ${short(opened.account, 8, 6)}.`}</T>}
      {opened?.balance != null && <><T s="label">Move it to</T>
        <TextInput selectionColor="#E040C8" style={styles.input} placeholder="any account, e.g. bob.testnet" placeholderTextColor={C.text3} value={dest} onChangeText={setDest} autoCapitalize="none" autoCorrect={false} accessibilityLabel="Account to move it to" />
        <T style={{ color: C.text3, fontSize: 12.5, lineHeight: 18 }}>Moving it to your own main account links the two again. This step is signed by the one-time key only.</T></>}
    </Card>}
  </Screen>;
}
