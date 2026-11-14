import { ApprovalSheet } from './src/ApprovalSheet';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, Image, Linking, Pressable, ScrollView, StyleSheet, Switch, TextInput, View, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import * as SecureStore from 'expo-secure-store';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { ArrowUpRight, ArrowDownLeft, ShieldCheck, KeyRound, Atom, Check, ShieldAlert, Power, ExternalLink, ChevronLeft, ScanLine, Network, EyeOff, Repeat, Copy } from 'lucide-react-native';
import { chainAddresses, signCrossChain, stealthSend, stealthScan, stealthSweep, intentsQuote, metaKey, INTENT_ROUTES, type EthTx } from '../../sdk/phase2.ts';
import { evm } from '../../sdk/chains.ts';
import { actions, base58, base64, execute, makeIntent, nearAmount, outcome, pqHandle, publicKeys, signIntent, submit, view, type Vault } from '../../sdk/index.ts';
import { edKeyString, precheckUpgrade, seedFromPrivateKey, upgradeInPlace } from '../../sdk/upgrade.ts';
import { createWithHelper } from '../../sdk/drillflow.ts';
import { random } from '../../sdk/index.ts';
import { ago, friendlyError, near, readAccount, readActivity, readKeys, readStatus, short, txUrl, type Activity, type KeyInfo } from '../../web/src/lib/chain.ts';
import { WALLET_WASM_B64 } from './src/wasm';
import { TabBar, ShieldSend, type Tab } from './src/TabBar';
import { ScanScreen, type ScanMode, type Sheet } from './src/ScanScreen';
import { parseScan } from './src/scan';
import { C, FONT, LOGO, MONO, T as Txt, TopGlow, fontAssets } from './src/theme';
import { ChainAvatars, StripeBar, shares, units, useAssets } from './src/Assets';

const VAULT = 'magen-vault';
/** Room under scrolling content for the floating tab bar: 10 pt lift + 66 pt bar + 30 pt raised Scan button + 16 pt gap (safe area added at use). */
export const TAB_CLEARANCE = 10 + 66 + 30 + 16;
const CACHE = 'magen-cache';

export default function App() {
  const [fonts] = useFonts(fontAssets);
  const [vault, setVault] = useState<Vault | null | undefined>(undefined);
  useEffect(() => { SecureStore.getItemAsync(VAULT).then(v => setVault(v ? JSON.parse(v) : null)).catch(() => setVault(null)); }, []);
  if (!fonts || vault === undefined) return <View style={{ flex: 1, backgroundColor: C.bg }} />;
  return <SafeAreaProvider><ApprovalSheet/><StatusBar style="light" />
    {vault ? <Wallet vault={vault} onReset={async () => { await SecureStore.deleteItemAsync(VAULT); setVault(null); }} />
      : <Onboarding onDone={async v => { await SecureStore.setItemAsync(VAULT, JSON.stringify(v)); setVault(v); }} />}
  </SafeAreaProvider>;
}

/* ---------- shared bits ---------- */
const T = ({ s, style, ...p }: any) => <Txt {...p} style={[s && styles[s as keyof typeof styles], style]} />;
function Btn({ title, onPress, kind = 'primary', icon, disabled, busy }: { title: string; onPress: () => void; kind?: 'primary' | 'dark' | 'light' | 'ghost'; icon?: any; disabled?: boolean; busy?: boolean }) {
  const bg = kind === 'primary' ? C.accent : kind === 'light' ? 'transparent' : C.s2;
  const sc = useRef(new Animated.Value(1)).current;
  const to = (v: number) => Animated.spring(sc, { toValue: v, useNativeDriver: true, damping: 14, stiffness: 320 }).start();
  return <Pressable onPressIn={() => to(0.96)} onPressOut={() => to(1)} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onPress(); }} disabled={disabled || busy} accessibilityRole="button" accessibilityLabel={title}>
    <Animated.View style={[styles.btn, { backgroundColor: bg, opacity: disabled ? 0.4 : 1, borderWidth: kind === 'primary' ? 0 : 1, borderColor: kind === 'light' ? C.line2 : C.line, transform: [{ scale: sc }] }, kind === 'primary' && styles.btnGlow]}>
      {busy ? <ActivityIndicator color="#fff" /> : icon}<T style={{ color: '#fff', fontWeight: '600', fontSize: 16 }}>{title}</T>
    </Animated.View>
  </Pressable>;
}
const Card = ({ children, style }: any) => <View style={[styles.card, style]}>{children}</View>;
const Pill = ({ text, tone = 'gray' }: { text: string; tone?: 'gray' | 'blue' | 'red' | 'green' | 'ink' }) => {
  const m = { gray: [C.s2, C.text2], blue: [C.accentSoft, C.accentText], red: [C.redSoft, C.redText], green: [C.accentSoft, C.accentText], ink: ['rgba(255,255,255,0.08)', C.text] }[tone];
  return <View style={[styles.pill, { backgroundColor: m[0] }]}><T style={{ color: m[1], fontSize: 12, fontWeight: '600' }}>{text}</T></View>;
};
const Ok = ({ children, onPress }: any) => <Pressable onPress={onPress} style={[styles.banner, { backgroundColor: C.accentSoft, borderColor: C.accentLine }]}>{children}</Pressable>;
const Err = ({ text }: { text: string }) => <View style={[styles.banner, { backgroundColor: C.redSoft, borderColor: 'rgba(255,90,106,0.3)' }]}><ShieldAlert color={C.red} size={18} /><T style={{ color: C.redText, flex: 1, lineHeight: 20 }}>{text}</T></View>;
const open = (h: string) => Linking.openURL(txUrl(h));
/** Who pays gas: the execute-only classical key, or, once that key is removed after Q-Day, the native ML-DSA-65 key. */
const feeSigner = (vault: Vault, live: Live | null) => {
  const edOnChain = live?.keys.some(k => k.scheme === 'ed25519');
  return edOnChain === false && live?.status?.migrated ? { account: vault.wallet, seed: vault.keys.pq, pq: true } : vault.relay;
};
const Logo = ({ size = 30 }: { size?: number }) => <Image source={require('./assets/logo.png')} style={{ width: size, height: size }} accessibilityLabel="Magen" />;

/* ---------- onboarding ---------- */
function Onboarding({ onDone }: { onDone: (v: Vault) => void }) {
  const [mode, setMode] = useState<'intro' | 'upgrade' | 'create'>('intro');
  const [account, setAccount] = useState(''); const [secret, setSecret] = useState(''); const [name, setName] = useState('');
  const [busy, setBusy] = useState(''); const [err, setErr] = useState('');
  const wasm = useMemo(() => base64.decode(WALLET_WASM_B64), []);
  const run = async () => {
    setErr('');
    try {
      let id: string, seed: Uint8Array, keys: string[];
      if (mode === 'create') {
        if (!/^[a-z0-9][a-z0-9-]{2,30}$/.test(name)) throw Error('Use 3–31 lowercase letters, numbers or hyphens.');
        id = `${name}.testnet`; seed = random();
        setBusy('Creating the testnet account…'); await createWithHelper(id, edKeyString(seed)); keys = [edKeyString(seed)];
      } else {
        id = account.trim().toLowerCase(); seed = seedFromPrivateKey(secret);
        setBusy('Checking the account on NEAR…');
        const c = await precheckUpgrade(id, seed, wasm.length);
        if (!c.ok) throw Error(c.problems.join(' '));
        keys = c.keys.map(k => k.public_key);
      }
      setBusy('Making your ML-DSA-65 key on this phone…');
      await new Promise(r => setTimeout(r, 50));
      setBusy('Adding the second lock (one transaction)…');
      const up = await upgradeInPlace(id, seed, wasm, keys);
      if (!up.result.success) throw Error(friendlyError(up.result.error));
      onDone({ wallet: id, keys: up.keys, relay: up.fee });
    } catch (e: any) { setErr(friendlyError(String(e.message))); } finally { setBusy(''); }
  };
  return <View style={{ flex: 1, backgroundColor: C.bg }}><TopGlow height={520} /><SafeAreaView style={{ flex: 1 }}>
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: 24, flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}><Logo size={34} /><T display style={{ fontSize: 22, letterSpacing: -0.6 }}>magen</T></View>
        {mode === 'intro' ? <>
          <Image source={require('./assets/art/quantum-lock.png')} style={{ width: 250, height: 250, alignSelf: 'center', marginVertical: 22 }} />
          <T display style={{ fontSize: 34, letterSpacing: -1.2, lineHeight: 38, textAlign: 'center' }}>Keep your NEAR account. Add a second lock.</T>
          <T style={{ color: C.text2, fontSize: 16, lineHeight: 24, marginTop: 12, textAlign: 'center' }}>Every payment needs your usual key and a post-quantum ML-DSA-65 key. NEAR checks both.</T>
          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 18 }}>
            <Pill tone="ink" text="ed25519" /><Pill tone="blue" text="+ ML-DSA-65" />
          </View>
          <View style={{ flex: 1 }} />
          <View style={{ gap: 10, marginTop: 28 }}>
            <Btn title="Upgrade an account I have" onPress={() => setMode('upgrade')} />
            <Btn title="Start with a new testnet account" kind="ghost" onPress={() => setMode('create')} />
            <T style={{ color: C.text3, fontSize: 12.5, textAlign: 'center', marginTop: 6 }}>NEAR testnet preview · keys stay in this phone’s keychain</T>
          </View>
        </> : <View style={{ gap: 14, marginTop: 24 }}>
          <Pressable onPress={() => setMode('intro')} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }} hitSlop={8}><ChevronLeft color={C.text2} size={18} /><T style={{ color: C.text2 }}>Back</T></Pressable>
          <Image source={mode === 'create' ? require('./assets/art/coin-magenta.png') : require('./assets/art/quantum-lock.png')} style={{ width: 150, height: 150, alignSelf: 'center' }} />
          <T display style={{ fontSize: 30, letterSpacing: -1 }}>{mode === 'create' ? 'Start fresh, upgraded.' : 'Upgrade in place.'}</T>
          <T style={{ color: C.text2, fontSize: 15, lineHeight: 22 }}>{mode === 'create' ? 'We create the account with 10 test NEAR, then add the second lock.' : 'Your key signs one transaction. It stays your first lock; a new ML-DSA-65 key becomes the second.'}</T>
          {mode === 'create' ? <View style={[styles.input, { flexDirection: 'row', alignItems: 'center' }]}>
              <TextInput selectionColor="#E040C8" style={{ flex: 1, fontFamily: FONT.m, fontSize: 16, color: C.text }} placeholder="yourname" placeholderTextColor={C.text3} value={name} onChangeText={t => setName(t.toLowerCase())} autoCapitalize="none" autoCorrect={false} accessibilityLabel="Account name" />
              <T style={{ color: C.text3, fontSize: 15 }}>.testnet</T></View>
            : <><TextInput selectionColor="#E040C8" style={styles.input} placeholder="alice.testnet" placeholderTextColor={C.text3} value={account} onChangeText={setAccount} autoCapitalize="none" autoCorrect={false} />
              <TextInput selectionColor="#E040C8" style={styles.input} placeholder="Private key (ed25519:…)" placeholderTextColor={C.text3} value={secret} onChangeText={setSecret} autoCapitalize="none" autoCorrect={false} secureTextEntry textContentType="none" autoComplete="off" />
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <T style={{ color: C.text3, fontSize: 12.5, flex: 1 }}>Stays on this phone. It only signs the upgrade.</T>
                <Pressable onPress={async () => setSecret((await Clipboard.getStringAsync()).trim())} hitSlop={10}><T style={{ color: C.accentText, fontWeight: '600' }}>{secret ? 'Key pasted' : 'Paste key'}</T></Pressable>
              </View></>}
          {!!err && <Err text={err} />}
          <Btn title={busy || (mode === 'create' ? 'Create and upgrade' : 'Upgrade in place')} busy={!!busy} onPress={run} disabled={mode === 'create' ? !name : !account || !secret} />
        </View>}
      </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView></View>;
}

/* ---------- wallet ---------- */
type Live = { amount: bigint | null; storage: number; keys: KeyInfo[]; status: any };
function Wallet({ vault, onReset }: { vault: Vault; onReset: () => void }) {
  const [tab, setTab] = useState<Tab>('home');
  const [scanMode, setScanMode] = useState<ScanMode>('scan');
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [prefill, setPrefill] = useState<Prefill | null>(null);
  const [live, setLive] = useState<Live | null>(null);
  const [acts, setActs] = useState<Activity[] | null>(null);
  const insets = useSafeAreaInsets();
  const fade = useRef(new Animated.Value(1)).current;
  // Last known balance shows instantly on launch (no skeletons); fresh chain data replaces it in a second.
  useEffect(() => { SecureStore.getItemAsync(CACHE).then(c => { if (c && !live) { const j = JSON.parse(c); setLive({ amount: BigInt(j.amount), storage: j.storage, keys: j.keys, status: j.status }); } }).catch(() => {}); }, []);
  const refresh = useCallback(async () => {
    try {
      const [a, k, s] = await Promise.all([readAccount(vault.wallet), readKeys(vault.wallet).catch(() => []), readStatus(vault.wallet)]);
      setLive({ amount: a?.amount ?? null, storage: a?.storage ?? 0, keys: k, status: s });
      if (a) SecureStore.setItemAsync(CACHE, JSON.stringify({ amount: a.amount.toString(), storage: a.storage, keys: k.slice(0, 3), status: s ? { nonce: s.nonce, migrated: s.migrated } : null })).catch(() => {});
      readActivity(vault.wallet, 15).then(setActs).catch(() => setActs(x => x ?? []));
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
  const props = { vault, live, acts, refresh, go: goTab, receive: () => openScan('code') };
  return <View style={{ flex: 1, backgroundColor: C.bg }}>
    {tab !== 'scan' && <TopGlow />}
    {/* Opaque header (own copy of the glow, same coordinates) so scrolled content never shows under it. */}
    <View style={{ paddingTop: insets.top, backgroundColor: C.bg, overflow: 'hidden', zIndex: 2 }}>
      {tab !== 'scan' && <TopGlow />}
      <View style={styles.top}><Logo size={30} />
        <View style={{ flex: 1 }}><T style={{ fontSize: 15, fontWeight: '600' }} numberOfLines={1}>{vault.wallet}</T><T style={{ fontSize: 12, color: C.text3 }}>NEAR testnet</T></View>
        <View style={styles.lockChip}><Atom color={C.accent} size={14} /><T style={{ color: C.accentText, fontSize: 12, fontWeight: '600' }}>{live?.status?.migrated ? 'PQ native' : '2 locks'}</T></View>
      </View>
    </View>
    {tab !== 'scan' && <Animated.ScrollView style={{ opacity: fade, transform: [{ translateY: fade.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] }} contentContainerStyle={{ padding: 16, paddingBottom: TAB_CLEARANCE + insets.bottom, gap: 14 }} keyboardShouldPersistTaps="handled">
      {tab === 'home' && <HomeTab {...props} />}
      {tab === 'send' && <SendTab {...props} prefill={prefill} />}
      {tab === 'activity' && <ActivityTab {...props} />}
      {tab === 'security' && <SecurityTab {...props} onReset={onReset} />}
      {tab === 'chains' && <ChainsTab {...props} />}
      {tab === 'private' && <PrivateTab {...props} />}
      {tab === 'swap' && <SwapTab {...props} />}
    </Animated.ScrollView>}
    {tab === 'scan' && <Animated.View style={[StyleSheet.absoluteFill, { opacity: fade }]}>
      <ScanScreen wallet={vault.wallet} mode={scanMode} setMode={m => { setSheet(null); setScanMode(m); }} sheet={sheet} onCode={route}
        onConfirm={p => send({ to: p.to, amount: p.amount, memo: p.memo, request: true })} onDismiss={() => setSheet(null)} top={insets.top} bottom={insets.bottom} />
    </Animated.View>}
    <TabBar tab={tab} onChange={t => (t === 'scan' && tab === 'scan' ? setSheet(null) : goTab(t))} bottom={insets.bottom} />
  </View>;
}
type P = { vault: Vault; live: Live | null; acts: Activity[] | null; refresh: () => void; go: (t: Tab) => void; receive: () => void };
type Prefill = { to: string; amount?: string; memo?: string; request?: boolean; key: number };

/** "8.48" with the decimals smaller and dimmer, as on the reference's balance. */
function BigNumber({ value, unit, size = 58 }: { value: string; unit?: string; size?: number }) {
  const [int, dec] = value.split('.');
  return <T display style={{ fontSize: size, letterSpacing: -size * 0.04, lineHeight: size * 1.12, textAlign: 'center' }} numberOfLines={1} adjustsFontSizeToFit>
    {int}{dec !== undefined && <T display style={{ fontSize: size * 0.5, color: C.text3, letterSpacing: 0 }}>.{dec}</T>}
    {unit ? <T style={{ fontSize: size * 0.3, color: C.text2, letterSpacing: 0, fontWeight: '500' }}>{'  '}{unit}</T> : null}
  </T>;
}

function HomeTab({ vault, live, acts, go, receive }: P) {
  const migrated = !!live?.status?.migrated;
  const assets = useAssets(vault.wallet, live?.amount);
  const sh = shares(assets);
  return <>
    <View style={{ alignItems: 'center', paddingTop: 10 }}>
      <T style={{ color: C.text2, fontSize: 15, fontWeight: '500' }}>Current Balance</T>
      <BigNumber value={near(live?.amount ?? null, 2)} unit="NEAR" />
      <View style={{ marginTop: 6 }}><Pill tone="blue" text={migrated ? 'Native PQ key on' : 'Two locks on · ed25519 + ML-DSA-65'} /></View>
      <T style={{ color: C.text2, fontSize: 15, fontWeight: '500', marginTop: 22, marginBottom: 12 }}>Your chains</T>
      <ChainAvatars ids={['near', 'bitcoin', 'zcash', 'ethereum', 'solana']} onPlus={() => go('chains')} />
    </View>
    <View style={{ gap: 12, marginTop: 10 }}>
      {assets.map((a, i) => {
        const amt = a.amount === null ? '—' : `${units(a.amount, a.decimals, a.id === 'near' ? 2 : 6)} ${a.symbol}`;
        return <View key={a.id} style={{ gap: 9 }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingHorizontal: 2 }}>
            <T style={{ fontSize: 16.5, fontWeight: '600' }}>{a.name}<T style={{ color: C.text3, fontSize: 13 }}>{'  '}{a.sub}</T></T>
            <Pressable onPress={() => go('activity')} hitSlop={10} accessibilityRole="button" accessibilityLabel={`${a.name} history`}><T style={{ color: C.text2, fontSize: 14.5 }}>History</T></Pressable>
          </View>
          <StripeBar pct={sh[i]} logo={a.logo} label={amt} a11y={`${a.name}: ${amt}${sh[i] === null ? '' : `, ${Math.round(sh[i]! * 100)} percent of value`}`} />
        </View>;
      })}
      <T style={{ color: C.text3, fontSize: 12, lineHeight: 17, paddingHorizontal: 2 }}>Amounts read live from NEAR testnet. Bar length is each asset’s share of value at 1Click’s live prices (18% minimum).</T>
    </View>
    <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
      <View style={{ flex: 1 }}><Btn title="Send" icon={<ArrowUpRight color="#fff" size={18} />} onPress={() => go('send')} /></View>
      <View style={{ flex: 1 }}><Btn title="Receive" kind="ghost" icon={<ArrowDownLeft color="#fff" size={18} />} onPress={receive} /></View>
    </View>
    <View style={{ flexDirection: 'row', gap: 10 }}>
      <Tile icon={<Network color={C.accent} size={20} />} title="Every chain" onPress={() => go('chains')} />
      <Tile icon={<EyeOff color={C.accent} size={20} />} title="Private send" onPress={() => go('private')} />
      <Tile icon={<Repeat color={C.accent} size={20} />} title="Swap" onPress={() => go('swap')} />
    </View>
    <Card>
      <View style={styles.cardHead}><T style={styles.h2}>Your two locks</T><Pressable onPress={() => go('security')} hitSlop={8}><T style={{ color: C.accentText, fontWeight: '600' }}>Q-Day switch</T></Pressable></View>
      <LockRow icon={<KeyRound color={C.text2} size={18} />} title="Lock 1 · ed25519" sub="Your existing key. Never enough alone." ok={!!live?.status} />
      <LockRow pq icon={<Atom color={C.accent} size={18} />} title="Lock 2 · ML-DSA-65" sub="Post-quantum. Checked on chain." ok={!!live?.status} />
      <LockRow pq icon={<Power color={C.accent} size={18} />} title="Native post-quantum key" sub={migrated ? 'On. In NEAR’s key list.' : 'Off. Flip the Q-Day switch.'} ok={migrated} last />
    </Card>
    <Card>
      <View style={styles.cardHead}><T style={styles.h2}>Recent activity</T><Pressable onPress={() => go('activity')} hitSlop={8}><T style={{ color: C.accentText, fontWeight: '600' }}>All</T></Pressable></View>
      {acts === null ? <ActivityIndicator color={C.accent} style={{ padding: 20 }} /> : acts.length ? acts.slice(0, 4).map(a => <ActRow key={a.hash} a={a} />) : <Empty />}
    </Card>
  </>;
}
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
    {a.amount && a.kind !== 'refused' ? <T style={{ fontWeight: '600', color: a.kind === 'received' ? C.accentText : C.text }}>{a.kind === 'received' ? '+' : '−'}{near(a.amount, 2)}</T> : a.kind === 'refused' ? <Pill text="Refused" tone="red" /> : <Pill text="Done" tone="green" />}
  </Pressable>;
}
const Empty = () => <View style={{ alignItems: 'center', padding: 20, gap: 6 }}><Image source={require('./assets/art/private-send.png')} style={{ width: 104, height: 104 }} /><T style={{ fontWeight: '600' }}>No activity yet</T><T style={{ color: C.text3 }}>Your first payment shows here.</T></View>;

/** Floor a yocto amount to a plain decimal string the amount field accepts. */
const nearPlain = (y: bigint, places = 4) => { const s = y.toString().padStart(25, '0'); const f = s.slice(-24).slice(0, places).replace(/0+$/, ''); return BigInt(s.slice(0, -24)).toString() + (f ? '.' + f : ''); };

function SendTab({ vault, live, refresh, go, prefill }: P & { prefill: Prefill | null }) {
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
      setRes(r); setStage('done'); Haptics.notificationAsync(r.success ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error); refresh();
    } catch (e: any) { setErr(friendlyError(String(e.message))); setStage('form'); }
  };
  const signedYet = stage === 'sending' || stage === 'done';
  const scanned = !!from && from.to === to.trim().toLowerCase();
  const maxStr = nearPlain(spendable > 0n ? spendable : 0n);
  const frac = spendable > 0n && amt ? Math.min(1, Number(amt) / Number(maxStr)) : null;
  return <>
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <T s="h1">Send</T>
      {stage === 'form' && <Pressable onPress={() => go('scan')} accessibilityRole="button" accessibilityLabel="Scan a code" style={styles.scanChip} hitSlop={6}><ScanLine color={C.accent} size={17} /><T style={{ color: C.accentText, fontWeight: '600', fontSize: 13.5 }}>Scan</T></Pressable>}
    </View>
    {scanned && <View style={[styles.banner, { backgroundColor: C.accentSoft, borderColor: C.accentLine, alignItems: 'center' }]}><ScanLine color={C.accent} size={18} />
      <View style={{ flex: 1 }}><T style={{ fontWeight: '600' }}>{from!.request ? 'From a Magen pay request' : 'From a scanned code'}</T>
        {!!from!.memo && <T style={{ color: C.text2, fontSize: 13, marginTop: 2 }} numberOfLines={2}>Memo: {from!.memo} (not sent on chain)</T>}</View></View>}
    <Card style={{ padding: 18, gap: 12 }}>
      <T s="label">To</T>
      <TextInput selectionColor="#E040C8" style={styles.input} placeholder="bob.testnet" placeholderTextColor={C.text3} value={to} onChangeText={setTo} autoCapitalize="none" autoCorrect={false} editable={stage === 'form'} />
      <T s="label">Amount</T>
      <View style={{ flexDirection: 'row', alignItems: 'center', height: 64, paddingHorizontal: 4 }}>
        <TextInput selectionColor="#E040C8" style={{ flex: 1, fontFamily: FONT.display, fontSize: 44, letterSpacing: -1.5, color: C.text }} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={C.text3} value={amt} onChangeText={t => setAmt(t.replace(/[^\d.]/g, ''))} editable={stage === 'form'} />
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
    {!!err && <Err text={err} />}
    {res && (res.success ? <Ok onPress={() => open(res.hash)}>
      <ShieldCheck color={C.accent} size={20} />
      <View style={{ flex: 1 }}><T style={{ fontWeight: '600', fontSize: 15.5 }}>{`Sent ${amt} NEAR. NEAR verified both signatures.`}</T>
        <T style={{ color: C.accentText, fontWeight: '600', marginTop: 4 }}>View transaction {short(res.hash)}</T></View>
      <Image source={require('./assets/art/quantum-lock.png')} style={{ width: 54, height: 54 }} /></Ok>
      : <Pressable onPress={() => open(res.hash)} style={[styles.banner, { backgroundColor: C.redSoft, borderColor: 'rgba(255,90,106,0.3)' }]}><ShieldAlert color={C.red} size={20} />
        <View style={{ flex: 1 }}><T style={{ fontWeight: '600', fontSize: 15.5, color: C.redText }}>{friendlyError(res.error)}</T>
          <T style={{ color: C.accentText, fontWeight: '600', marginTop: 4 }}>View transaction {short(res.hash)}</T></View></Pressable>)}
    {stage === 'done' ? <Btn title="New payment" kind="light" onPress={() => { setStage('form'); setRes(null); setAmt(''); }} />
      : <Btn title={stage === 'signing' ? 'Signing with both keys…' : stage === 'sending' ? 'NEAR is checking both…' : 'Sign twice and send'} icon={<ShieldSend size={22} />} busy={stage !== 'form'} disabled={!to || !amt} onPress={send} />}
  </>;
}
const SigRow = ({ icon, title, sub, done, pq }: any) => <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, paddingRight: 14, borderRadius: 999, backgroundColor: C.s2 }}>
  <View style={[styles.ico, { width: 36, height: 36, backgroundColor: pq ? C.accentSoft : 'rgba(255,255,255,0.08)' }]}>{icon}</View>
  <View style={{ flex: 1 }}><T style={{ fontWeight: '600' }}>{title}</T><T style={{ color: C.text2, fontSize: 12.5 }}>{sub}</T></View>
  {done && <View style={styles.okDot}><Check color="#fff" size={14} strokeWidth={3} /></View>}
</View>;

function ActivityTab({ acts }: P) {
  return <><T s="h1">Activity</T><Card>{acts === null ? <ActivityIndicator color={C.accent} style={{ padding: 24 }} /> : acts.length ? acts.map(a => <ActRow key={a.hash} a={a} />) : <Empty />}</Card>
    <T style={{ color: C.text3, fontSize: 12.5 }}>From NearBlocks; each wallet action decoded from its on-chain arguments.</T></>;
}

function SecurityTab({ vault, live, refresh, onReset }: P & { onReset: () => void }) {
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
        setRes(r); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); setTimeout(refresh, 2500);
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
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setTimeout(refresh, 2500);
      } catch (e: any) { setRes({ hash: '', success: false, error: String(e.message) }); } finally { setBusy(''); }
    } }]);
  return <>
    <T s="h1">Security</T>
    <Card style={{ padding: 20, gap: 12 }}>
      <Image source={require('./assets/art/quantum-lock.png')} style={{ position: 'absolute', right: -8, top: 4, width: 120, height: 120 }} />
      <Pill tone={on ? 'blue' : 'gray'} text={on ? 'Switched on' : 'Off'} />
      <T display style={{ fontSize: 24, letterSpacing: -0.6, maxWidth: 220 }}>{on ? 'Your post-quantum key is native on NEAR.' : 'Q-Day switch'}</T>
      <T style={{ color: C.text2, fontSize: 14.5, lineHeight: 21, maxWidth: 240 }}>{on ? 'NEAR lists your ML-DSA-65 key in the account’s access keys.' : 'One switch adds your ML-DSA-65 key as a native NEAR key. Same account, same balance.'}</T>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 12, paddingLeft: 14, borderRadius: 999, backgroundColor: C.s2 }}>
        <Switch value={on} onValueChange={() => !on && flip()} disabled={on || !!busy} trackColor={{ true: C.accent, false: C.s3 }} thumbColor="#fff" ios_backgroundColor={C.s3} />
        <View style={{ flex: 1 }}><T style={{ fontWeight: '600' }}>{on ? 'Native ML-DSA-65 key: on' : 'Add native ML-DSA-65 key'}</T><T style={{ color: C.text2, fontSize: 12.5 }}>{busy || 'Signed with both locks'}</T></View>
        {!!busy && <ActivityIndicator color="#fff" />}
      </View>
      {res?.hash ? <Pressable onPress={() => open(res.hash)}><T style={{ color: C.accentText, fontWeight: '600' }}>{res.success ? 'Transaction' : friendlyError(res.error)} {short(res.hash)} ↗</T></Pressable> : null}
      {on && edKey && <Btn title={busy ? busy : 'Remove the classical key'} kind="ghost" busy={!!busy} onPress={dropClassical} />}
      {on && live && !edKey && <T style={{ color: C.accentText, fontSize: 13.5 }}>Only post-quantum keys remain on this account.</T>}
    </Card>
    <Card>
      <View style={styles.cardHead}><T style={styles.h2}>What NEAR sees</T><Pressable onPress={() => Linking.openURL(`https://testnet.near.rocks/account/${vault.wallet}`)} hitSlop={8}><ExternalLink color={C.accent} size={18} /></Pressable></View>
      {(live?.keys ?? []).map((k, i, a) => <View key={k.publicKey} style={[styles.row, i === a.length - 1 && { borderBottomWidth: 0 }]}>
        <View style={[styles.ico, k.scheme === 'ML-DSA-65' && { backgroundColor: C.accentSoft }]}>{k.scheme === 'ML-DSA-65' ? <Atom color={C.accent} size={18} /> : <KeyRound color={C.text2} size={18} />}</View>
        <View style={{ flex: 1 }}><T style={{ fontWeight: '600' }}>{k.scheme} · {k.full ? 'full access' : 'execute only'}</T><T numberOfLines={1} style={{ color: C.text3, fontSize: 12, fontFamily: MONO }}>{k.publicKey}</T></View>
      </View>)}
      {!on && <View style={[styles.row, { borderBottomWidth: 0 }]}><T style={{ color: C.text3, fontSize: 12.5, flex: 1 }}>After the switch: {short(handle, 22, 6)}</T></View>}
    </Card>
    <Btn title="Remove wallet from this phone" kind="light" onPress={() => Alert.alert('Remove wallet?', 'Keys are deleted from this phone. Without another copy of both keys you lose access.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Remove', style: 'destructive', onPress: onReset }])} />
  </>;
}

/* ---------- phase 2: every chain, private send, swap ---------- */
const Tile = ({ icon, title, onPress }: any) => <Pressable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onPress(); }} style={({ pressed }) => [styles.tile, { transform: [{ scale: pressed ? 0.96 : 1 }] }]} accessibilityRole="button" accessibilityLabel={title}>
  <View style={[styles.ico, { backgroundColor: C.accentSoft }]}>{icon}</View><T style={{ fontWeight: '600', fontSize: 14 }}>{title}</T></Pressable>;
const Back = ({ go, title, sub }: any) => <View style={{ gap: 6 }}>
  <Pressable onPress={() => go('home')} style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }} hitSlop={8}><ChevronLeft color={C.text3} size={18} /><T style={{ color: C.text3 }}>Home</T></Pressable>
  <T s="h1">{title}</T>{sub ? <T style={{ color: C.text2, fontSize: 14.5, lineHeight: 21 }}>{sub}</T> : null}</View>;
const feeOf = (vault: Vault, live: Live | null) => live?.keys.some(k => k.scheme === 'ed25519') === false && live?.status?.migrated ? { account: vault.wallet, seed: vault.keys.pq, pq: true } : vault.relay;

function ChainsTab({ vault, live, go }: P) {
  const [addrs, setAddrs] = useState<any[] | null>(null); const [err, setErr] = useState('');
  const [busy, setBusy] = useState(''); const [res, setRes] = useState<any>(null);
  useEffect(() => { chainAddresses(vault.wallet).then(setAddrs).catch(e => setErr(String(e.message))); }, [vault.wallet]);
  const ask = async (dropPq: boolean) => {
    const eth = addrs?.find(a => a.id === 'ethereum'); if (!eth) return; setRes(null); setErr('');
    try {
      setBusy(dropPq ? 'Asking with the classical signature only…' : 'Signing twice, then asking the MPC…'); await new Promise(r => setTimeout(r, 60));
      const RPC = 'https://ethereum-sepolia-rpc.publicnode.com';
      const [nonce, gp, bal] = await Promise.all([evm(RPC, 'eth_getTransactionCount', [eth.address, 'latest']), evm(RPC, 'eth_gasPrice', []), evm(RPC, 'eth_getBalance', [eth.address, 'latest'])]);
      const tx: EthTx = { chainId: 11155111n, nonce: BigInt(nonce), maxPriorityFeePerGas: 1_000_000_000n, maxFeePerGas: BigInt(gp) * 2n + 1_000_000_000n, gas: 21000n, to: eth.address, value: 1_000_000_000_000_000n };
      const r = await signCrossChain(feeOf(vault, live), vault.wallet, vault.keys, { chain: 'ethereum', tx, from: eth.address }, { dropPq });
      setRes({ ...r, needsGas: BigInt(bal) < 21000n * tx.maxFeePerGas + tx.value });
      Haptics.notificationAsync(r.success ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error);
    } catch (e: any) { setErr(friendlyError(String(e.message))); } finally { setBusy(''); }
  };
  return <>
    <Back go={go} title="Every chain" sub="NEAR's MPC signs for these addresses only after your Magen wallet verifies both signatures. The chains themselves stay classical." />
    <Card>{addrs === null ? <ActivityIndicator color={C.accent} style={{ padding: 24 }} /> : addrs.map((a, i) => <View key={a.id} style={[styles.row, i === addrs.length - 1 && { borderBottomWidth: 0 }]}>
      <View style={[styles.ico, { backgroundColor: '#fff' }]}>{LOGO[a.id] ? <Image source={LOGO[a.id]} style={{ width: 22, height: 22 }} resizeMode="contain" /> : <T style={{ color: C.bg, fontWeight: '700' }}>{a.name.slice(0, 1)}</T>}</View>
      <View style={{ flex: 1 }}><T style={{ fontWeight: '600', fontSize: 15 }}>{a.name} <T style={{ color: C.text3, fontSize: 12.5 }}>{a.network}</T></T>
        <T numberOfLines={1} style={{ color: C.text2, fontSize: 12.5, fontFamily: MONO, marginTop: 2 }}>{short(a.address, 12, 8)}</T>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 5 }}><Atom color={C.accent} size={12} /><T style={{ color: C.accentText, fontSize: 11.5, fontWeight: '600' }}>Guarded by your quantum key</T></View></View>
      <Pressable onPress={() => Clipboard.setStringAsync(a.address)} hitSlop={8} accessibilityLabel={`Copy ${a.name} address`}><Copy color={C.text3} size={17} /></Pressable>
    </View>)}</Card>
    <Card style={{ padding: 20, gap: 12 }}>
      <T display style={{ fontSize: 19 }}>Ask for an Ethereum signature</T>
      <T style={{ color: C.text2, fontSize: 13.5, lineHeight: 20 }}>A 0.001 Sepolia ETH transfer. NEAR checks ed25519 and ML-DSA-65, then asks v1.signer-prod.testnet.</T>
      {res && (res.success ? <Ok onPress={() => open(res.hash)}><ShieldCheck color={C.accent} size={20} />
        <View style={{ flex: 1, gap: 4 }}><T style={{ fontWeight: '600', fontSize: 15 }}>MPC signature returned after both your signatures verified.</T>
          <T style={{ color: C.text2, fontSize: 13 }}>{res.needsGas ? 'Needs Sepolia gas to broadcast: fund your Ethereum address above.' : 'Ready to broadcast on Sepolia.'}</T>
          <T style={{ color: C.accentText, fontWeight: '600' }}>NEAR request {short(res.hash)}</T></View></Ok>
      : <Pressable onPress={() => open(res.hash)} style={[styles.banner, { backgroundColor: C.redSoft, borderColor: 'rgba(255,90,106,0.3)' }]}><ShieldAlert color={C.red} size={20} />
        <View style={{ flex: 1, gap: 4 }}><T style={{ fontWeight: '600', color: C.redText, fontSize: 15 }}>{friendlyError(res.error)}</T><T style={{ color: C.redText, fontSize: 13 }}>NEAR never asked the MPC, so nothing was signed.</T>
          <T style={{ color: C.accentText, fontWeight: '600' }}>Refusal {short(res.hash)}</T></View></Pressable>)}
      <Btn title={busy && !busy.includes('classical') ? busy : 'Sign twice, ask the MPC'} busy={!!busy && !busy.includes('classical')} disabled={!addrs || !!busy} onPress={() => ask(false)} icon={<ShieldSend size={20} />} />
      <Btn title={busy.includes('classical') ? busy : 'Try with one signature'} kind="ghost" busy={busy.includes('classical')} disabled={!addrs || !!busy} onPress={() => ask(true)} />
    </Card>
    {!!err && <Err text={err} />}
  </>;
}

function PrivateTab({ vault, live, go, refresh }: P) {
  const [mode, setMode] = useState<'send' | 'receive'>('send');
  const [meta, setMeta] = useState(''); const [amt, setAmt] = useState('0.1'); const [busy, setBusy] = useState(''); const [err, setErr] = useState('');
  const [sent, setSent] = useState<any>(null); const [note, setNote] = useState(''); const [opened, setOpened] = useState<any>(null); const [dest, setDest] = useState(''); const [swept, setSwept] = useState<any>(null);
  const mine = useMemo(() => metaKey(vault.keys), [vault]);
  const run = async (fn: () => Promise<void>) => { setErr(''); try { await fn(); } catch (e: any) { setErr(friendlyError(String(e.message))); } finally { setBusy(''); } };
  return <>
    <Back go={go} title="Private send" sub="The payment lands in a one-time account only the recipient can open. Hidden: who it really belongs to. Public: your account, the amount, the time." />
    <View style={styles.seg}>{(['send', 'receive'] as const).map(m => <Pressable key={m} onPress={() => setMode(m)} style={[styles.segBtn, mode === m && styles.segOn]}><T style={{ fontWeight: '600', color: mode === m ? C.text : C.text3 }}>{m === 'send' ? 'Send privately' : 'Receive privately'}</T></Pressable>)}</View>
    {mode === 'send' ? <Card style={{ padding: 18, gap: 12 }}>
      <T s="label">Recipient's meta-key</T>
      <View style={{ flexDirection: 'row', gap: 8 }}><TextInput selectionColor="#E040C8" style={[styles.input, { flex: 1 }]} placeholder="magen-meta:…" placeholderTextColor={C.text3} value={meta} onChangeText={setMeta} autoCapitalize="none" autoCorrect={false} />
        <Pressable onPress={async () => setMeta((await Clipboard.getStringAsync()).trim())} style={[styles.input, { width: 80, alignItems: 'center', justifyContent: 'center' }]}><T style={{ color: C.accentText, fontWeight: '600' }}>Paste</T></Pressable></View>
      <T s="label">Amount (NEAR)</T>
      <TextInput selectionColor="#E040C8" style={styles.input} keyboardType="decimal-pad" value={amt} onChangeText={t => setAmt(t.replace(/[^\d.]/g, ''))} />
      <Btn title={busy || 'Sign twice and send privately'} busy={!!busy} disabled={!meta} icon={<ShieldSend size={20} />} onPress={() => run(async () => { setBusy('Signing twice…'); await new Promise(r => setTimeout(r, 60)); const r = await stealthSend(feeOf(vault, live), vault.wallet, vault.keys, meta, amt); setSent(r); refresh(); })} />
      {sent && <View style={[styles.banner, { backgroundColor: sent.success ? C.accentSoft : C.redSoft, borderColor: sent.success ? C.accentLine : 'rgba(255,90,106,0.3)', flexDirection: 'column' }]}>
        <T style={{ fontWeight: '600', fontSize: 15, color: sent.success ? C.text : C.redText }}>{sent.success ? 'Sent to a one-time account.' : friendlyError(sent.error)}</T>
        {sent.success && <><T style={{ color: C.text2, fontSize: 13 }}>Give the recipient this note:</T><Pressable onPress={() => Clipboard.setStringAsync(sent.note)}><T style={{ fontFamily: MONO, fontSize: 12, color: C.text }}>{short(sent.note, 22, 6)}  (tap to copy)</T></Pressable></>}
        <Pressable onPress={() => open(sent.hash)}><T style={{ color: C.accentText, fontWeight: '600' }}>Transaction {short(sent.hash)}</T></Pressable></View>}
    </Card> : <Card style={{ padding: 18, gap: 12 }}>
      <T s="label">Your meta-key (safe to share)</T>
      <Pressable onPress={() => Clipboard.setStringAsync(mine)} style={[styles.input, { justifyContent: 'center' }]}><T numberOfLines={1} style={{ fontFamily: MONO, fontSize: 12.5 }}>{short(mine, 24, 6)}</T></Pressable>
      <T s="label">Open a payment note</T>
      <View style={{ flexDirection: 'row', gap: 8 }}><TextInput selectionColor="#E040C8" style={[styles.input, { flex: 1 }]} placeholder="magen-note:…" placeholderTextColor={C.text3} value={note} onChangeText={setNote} autoCapitalize="none" autoCorrect={false} />
        <Pressable onPress={async () => setNote((await Clipboard.getStringAsync()).trim())} style={[styles.input, { width: 80, alignItems: 'center', justifyContent: 'center' }]}><T style={{ color: C.accentText, fontWeight: '600' }}>Paste</T></Pressable></View>
      <Btn title="Open note" kind="dark" disabled={!note} onPress={() => run(async () => { setSwept(null); setOpened(await stealthScan(vault.keys, note)); })} />
      {opened && <T style={{ color: C.text2 }}>One-time account {short(opened.account, 8, 6)}: {opened.balance === null ? 'empty or already spent.' : `${near(opened.balance, 4)} NEAR`}</T>}
      {opened?.balance != null && <><TextInput selectionColor="#E040C8" style={styles.input} placeholder="Spend it to (any account)" placeholderTextColor={C.text3} value={dest} onChangeText={setDest} autoCapitalize="none" autoCorrect={false} />
        <T style={{ color: C.text3, fontSize: 12.5 }}>Spending to your own main account links the two again.</T>
        <Btn title={busy || 'Spend from the one-time account'} busy={!!busy} disabled={!dest} onPress={() => run(async () => { setBusy('Spending…'); setSwept(await stealthSweep(opened, dest.trim().toLowerCase())); })} /></>}
      {swept && <Pressable onPress={() => open(swept.hash)}><T style={{ color: swept.success ? C.accentText : C.red, fontWeight: '600' }}>{swept.success ? 'Spent' : 'Failed'} · {short(swept.hash)}</T></Pressable>}
    </Card>}
    {!!err && <Err text={err} />}
  </>;
}

function SwapTab({ go }: P) {
  const [from, setFrom] = useState('wNEAR'); const [to, setTo] = useState('ZEC'); const [amt, setAmt] = useState('10');
  const [busy, setBusy] = useState(false); const [q, setQ] = useState<any>(null); const [err, setErr] = useState('');
  const quote = async () => { setErr(''); setQ(null); setBusy(true); try { if (from === to) throw Error('Pick two different assets.'); setQ(await intentsQuote(from, to, amt, to === 'SOL' ? 'KD18rb7mrVBP7eJpn6EbULRkSupGQPmf56es7fubDrZ' : to === 'ETH' ? '0xf06d7f1851db534a680e6e856697cbbd4557a38b' : to === 'BTC' ? 'bc1qxm4wpa7kfqmpgxa3sr8j2kvef30sjsz72wjsks' : 'near')); } catch (e: any) { setErr(String(e.message)); } finally { setBusy(false); } };
  const LOGO_OF: Record<string, string> = { wNEAR: 'near', ZEC: 'zcash', SOL: 'solana', ETH: 'ethereum', BTC: 'bitcoin' };
  const Chips = ({ v, set }: any) => <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{INTENT_ROUTES.map(r => <Pressable key={r.symbol} onPress={() => { set(r.symbol); setQ(null); }} style={[styles.chip, v === r.symbol && styles.chipOn]}>
    {LOGO[LOGO_OF[r.symbol]] && <View style={styles.chipLogo}><Image source={LOGO[LOGO_OF[r.symbol]]} style={{ width: 14, height: 14 }} resizeMode="contain" /></View>}
    <T style={{ fontWeight: '600', color: v === r.symbol ? '#fff' : C.text2 }}>{r.label}</T></Pressable>)}</View>;
  return <>
    <Back go={go} title="Swap & bridge" sub="Live prices from NEAR Intents. Quote only — mainnet funding required." />
    <Card style={{ padding: 18, gap: 12 }}>
      <T s="label">You pay</T><Chips v={from} set={setFrom} />
      <TextInput selectionColor="#E040C8" style={[styles.input, { fontSize: 28, height: 64, fontFamily: FONT.display }]} keyboardType="decimal-pad" value={amt} onChangeText={t => { setAmt(t.replace(/[^\d.]/g, '')); setQ(null); }} />
      <T s="label">You get</T><Chips v={to} set={setTo} />
      <Btn title={busy ? 'Asking NEAR Intents…' : 'Get a live quote'} busy={busy} disabled={!amt} icon={<Repeat color="#fff" size={18} />} onPress={quote} />
    </Card>
    {q && <Card style={{ padding: 20, gap: 8 }}>
      <T style={{ color: C.text2 }}>{q.amountIn} {q.from.symbol} →</T>
      <T display style={{ fontSize: 40, letterSpacing: -1.5 }}>{q.amountOut} <T style={{ color: C.text2, fontSize: 18 }}>{q.to.symbol}</T></T>
      <T style={{ color: C.text2, fontSize: 13 }}>${Number(q.usdIn).toFixed(2)} → ${Number(q.usdOut).toFixed(2)} · about {q.seconds} s</T>
      <Pill tone="blue" text={q.status} />
    </Card>}
    {!!err && <Err text={err} />}
  </>;
}

const styles = StyleSheet.create({
  tile: { flex: 1, backgroundColor: C.s1, borderRadius: 22, borderWidth: 1, borderColor: C.line, padding: 14, gap: 10, alignItems: 'flex-start' },
  seg: { flexDirection: 'row', backgroundColor: C.s1, borderRadius: 999, padding: 4, borderWidth: 1, borderColor: C.line },
  segBtn: { flex: 1, height: 42, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  segOn: { backgroundColor: C.s3 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 6, paddingRight: 14, height: 36, borderRadius: 18, borderWidth: 1, borderColor: C.line, backgroundColor: C.s2 },
  chipOn: { backgroundColor: C.accent, borderColor: C.accent },
  chipLogo: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  btnGlow: { shadowColor: C.accent, shadowOpacity: 0.35, shadowRadius: 14, shadowOffset: { width: 0, height: 6 } },
  lockChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 11, height: 30, borderRadius: 15, backgroundColor: C.accentSoft, borderWidth: 1, borderColor: C.accentLine },
  btn: { height: 54, borderRadius: 999, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 18 },
  card: { backgroundColor: C.s1, borderRadius: 24, borderWidth: 1, borderColor: C.line, overflow: 'hidden' },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 6 },
  h1: { fontFamily: FONT.display, fontSize: 30, letterSpacing: -1, marginTop: 4 },
  h2: { fontSize: 17, fontWeight: '600' },
  label: { fontSize: 13.5, fontWeight: '600', color: C.text2 },
  pill: { alignSelf: 'flex-start', paddingHorizontal: 11, height: 26, borderRadius: 999, justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 13, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.1)' },
  ico: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.s2, alignItems: 'center', justifyContent: 'center' },
  okDot: { width: 24, height: 24, borderRadius: 12, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center' },
  top: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, height: 54 },
  input: { borderWidth: 1, borderColor: C.line, borderRadius: 999, height: 52, paddingHorizontal: 18, fontFamily: FONT.m, fontSize: 16, color: C.text, backgroundColor: C.s2 },
  scanChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, height: 36, borderRadius: 18, backgroundColor: C.accentSoft, borderWidth: 1, borderColor: C.accentLine, marginTop: 4 },
  banner: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', padding: 14, borderRadius: 20, borderWidth: 1 },
});
