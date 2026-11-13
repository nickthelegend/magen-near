import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, Image, Linking, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import * as SecureStore from 'expo-secure-store';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import QRCode from 'react-native-qrcode-svg';
import { ArrowUpRight, ArrowDownLeft, History, ShieldCheck, KeyRound, Atom, Check, ShieldAlert, Copy, Power, ExternalLink, ChevronLeft } from 'lucide-react-native';
import { base64, execute, makeIntent, nearAmount, pqHandle, publicKeys, signIntent, view, type Vault } from '../../sdk/index.ts';
import { edKeyString, precheckUpgrade, seedFromPrivateKey, upgradeInPlace } from '../../sdk/upgrade.ts';
import { createWithHelper } from '../../sdk/drillflow.ts';
import { random } from '../../sdk/index.ts';
import { ago, friendlyError, near, readAccount, readActivity, readKeys, readStatus, short, txUrl, type Activity, type KeyInfo } from '../../web/src/lib/chain.ts';
import { WALLET_WASM_B64 } from './src/wasm';
import { TabBar, ShieldSend, type Tab } from './src/TabBar';

const C = { ink: '#0b0e14', graphite: '#1b212b', bg: '#f3f4f6', paper: '#ffffff', line: '#e4e7ec', text: '#0e131c', text2: '#4b5466', text3: '#7a8394', onInk: '#eef1f6', onInk2: '#9aa3b4', cobalt: '#3366ff', cobaltSoft: '#ebf0ff', red: '#d93036', redSoft: '#fdeeee', green: '#138a5c', greenSoft: '#e5f5ee' };
const F = 'Commissioner';
const VAULT = 'magen-vault';
const CACHE = 'magen-cache';

export default function App() {
  const [fonts] = useFonts({ Commissioner: require('./assets/commissioner.ttf') });
  const [vault, setVault] = useState<Vault | null | undefined>(undefined);
  useEffect(() => { SecureStore.getItemAsync(VAULT).then(v => setVault(v ? JSON.parse(v) : null)).catch(() => setVault(null)); }, []);
  if (!fonts || vault === undefined) return <View style={{ flex: 1, backgroundColor: C.ink }} />;
  return <SafeAreaProvider><StatusBar style={vault ? 'dark' : 'light'} />
    {vault ? <Wallet vault={vault} onReset={async () => { await SecureStore.deleteItemAsync(VAULT); setVault(null); }} />
      : <Onboarding onDone={async v => { await SecureStore.setItemAsync(VAULT, JSON.stringify(v)); setVault(v); }} />}
  </SafeAreaProvider>;
}

/* ---------- shared bits ---------- */
const T = ({ s, style, ...p }: any) => <Text {...p} style={[{ fontFamily: F, color: C.text }, s && styles[s as keyof typeof styles], style]} />;
function Btn({ title, onPress, kind = 'primary', icon, disabled, busy }: { title: string; onPress: () => void; kind?: 'primary' | 'dark' | 'light' | 'ghost'; icon?: any; disabled?: boolean; busy?: boolean }) {
  const bg = kind === 'primary' ? C.cobalt : kind === 'dark' ? C.ink : kind === 'ghost' ? 'rgba(255,255,255,.1)' : C.paper;
  const fg = kind === 'light' ? C.text : '#fff';
  const sc = useRef(new Animated.Value(1)).current;
  const to = (v: number) => Animated.spring(sc, { toValue: v, useNativeDriver: true, damping: 14, stiffness: 320 }).start();
  return <Pressable onPressIn={() => to(0.96)} onPressOut={() => to(1)} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onPress(); }} disabled={disabled || busy} accessibilityRole="button" accessibilityLabel={title}>
    <Animated.View style={[styles.btn, { backgroundColor: bg, opacity: disabled ? 0.45 : 1, borderWidth: kind === 'light' ? 1 : 0, transform: [{ scale: sc }] }, kind === 'primary' && styles.btnGlow]}>
      {busy ? <ActivityIndicator color={fg} /> : icon}<T style={{ color: fg, fontWeight: '600', fontSize: 16 }}>{title}</T>
    </Animated.View>
  </Pressable>;
}
const Card = ({ children, style }: any) => <View style={[styles.card, style]}>{children}</View>;
const Pill = ({ text, tone = 'gray' }: { text: string; tone?: 'gray' | 'blue' | 'red' | 'green' | 'ink' }) => {
  const m = { gray: ['#eef0f3', C.text2], blue: [C.cobaltSoft, '#1739a8'], red: [C.redSoft, C.red], green: [C.greenSoft, C.green], ink: ['rgba(255,255,255,.1)', C.onInk] }[tone];
  return <View style={[styles.pill, { backgroundColor: m[0] }]}><T style={{ color: m[1], fontSize: 12, fontWeight: '600' }}>{text}</T></View>;
};
const open = (h: string) => Linking.openURL(txUrl(h));

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
      onDone({ wallet: id, keys: up.keys, relay: { account: id, seed: base64.encode(seed) } });
    } catch (e: any) { setErr(friendlyError(String(e.message))); } finally { setBusy(''); }
  };
  return <View style={{ flex: 1, backgroundColor: C.ink }}><SafeAreaView style={{ flex: 1 }}>
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: 24, flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}><Image source={require('./assets/icon.png')} style={{ width: 32, height: 32, borderRadius: 9 }} /><T style={{ color: '#fff', fontSize: 20, fontWeight: '700' }}>magen</T></View>
        {mode === 'intro' ? <>
          <Image source={require('./assets/shield-wallet.png')} style={{ width: 240, height: 240, alignSelf: 'center', marginVertical: 28 }} />
          <T style={{ color: '#fff', fontSize: 34, fontWeight: '600', letterSpacing: -1, lineHeight: 38 }}>Keep your NEAR account. Add a second lock.</T>
          <T style={{ color: C.onInk2, fontSize: 16, lineHeight: 24, marginTop: 12 }}>Every payment needs your usual key and a post-quantum ML-DSA-65 key. NEAR checks both.</T>
          <View style={{ flex: 1 }} />
          <View style={{ gap: 10, marginTop: 28 }}>
            <Btn title="Upgrade an account I have" onPress={() => setMode('upgrade')} />
            <Btn title="Start with a new testnet account" kind="ghost" onPress={() => setMode('create')} />
            <T style={{ color: C.onInk2, fontSize: 12.5, textAlign: 'center', marginTop: 6 }}>NEAR testnet preview · keys stay in this phone’s keychain</T>
          </View>
        </> : <View style={{ gap: 14, marginTop: 24 }}>
          <Pressable onPress={() => setMode('intro')} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><ChevronLeft color={C.onInk2} size={18} /><T style={{ color: C.onInk2 }}>Back</T></Pressable>
          <T style={{ color: '#fff', fontSize: 28, fontWeight: '600', letterSpacing: -.8 }}>{mode === 'create' ? 'Start fresh, upgraded.' : 'Upgrade in place.'}</T>
          <T style={{ color: C.onInk2, fontSize: 15, lineHeight: 22 }}>{mode === 'create' ? 'We create the account with 10 test NEAR, then add the second lock.' : 'Your key signs one transaction. It stays your first lock; a new ML-DSA-65 key becomes the second.'}</T>
          {mode === 'create' ? <TextInput style={styles.inputDark} placeholder="yourname" placeholderTextColor={C.onInk2} value={name} onChangeText={t => setName(t.toLowerCase())} autoCapitalize="none" autoCorrect={false} />
            : <><TextInput style={styles.inputDark} placeholder="alice.testnet" placeholderTextColor={C.onInk2} value={account} onChangeText={setAccount} autoCapitalize="none" autoCorrect={false} />
              <TextInput style={styles.inputDark} placeholder="Private key (ed25519:…)" placeholderTextColor={C.onInk2} value={secret} onChangeText={setSecret} autoCapitalize="none" autoCorrect={false} secureTextEntry textContentType="none" autoComplete="off" />
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <T style={{ color: C.onInk2, fontSize: 12.5, flex: 1 }}>Stays on this phone. It only signs the upgrade.</T>
                <Pressable onPress={async () => setSecret((await Clipboard.getStringAsync()).trim())} hitSlop={10}><T style={{ color: '#8fa8ff', fontWeight: '600' }}>{secret ? 'Key pasted' : 'Paste key'}</T></Pressable>
              </View></>}
          {!!err && <View style={[styles.banner, { backgroundColor: C.redSoft }]}><ShieldAlert color={C.red} size={18} /><T style={{ color: '#8e1d22', flex: 1, lineHeight: 20 }}>{err}</T></View>}
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
  const go = (t: Tab) => { if (t === tab) return; fade.setValue(0); setTab(t); Animated.timing(fade, { toValue: 1, duration: 260, useNativeDriver: true }).start(); };
  const props = { vault, live, acts, refresh, go };
  return <View style={{ flex: 1, backgroundColor: C.bg }}>
    <View style={{ paddingTop: insets.top, backgroundColor: C.bg }}>
      <View style={styles.top}><Image source={require('./assets/icon.png')} style={{ width: 30, height: 30, borderRadius: 9 }} />
        <View style={{ flex: 1 }}><T style={{ fontSize: 15, fontWeight: '600' }} numberOfLines={1}>{vault.wallet}</T><T style={{ fontSize: 12, color: C.text3 }}>NEAR testnet</T></View>
        <View style={styles.lockChip}><Atom color={C.cobalt} size={14} /><T style={{ color: '#1739a8', fontSize: 12, fontWeight: '600' }}>{live?.status?.migrated ? 'PQ native' : '2 locks'}</T></View>
      </View>
    </View>
    <Animated.ScrollView style={{ opacity: fade, transform: [{ translateY: fade.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] }} contentContainerStyle={{ padding: 16, paddingBottom: 130, gap: 14 }} keyboardShouldPersistTaps="handled">
      {tab === 'home' && <HomeTab {...props} />}
      {tab === 'send' && <SendTab {...props} />}
      {tab === 'receive' && <ReceiveTab {...props} />}
      {tab === 'activity' && <ActivityTab {...props} />}
      {tab === 'security' && <SecurityTab {...props} onReset={onReset} />}
    </Animated.ScrollView>
    <TabBar tab={tab} onChange={go} bottom={insets.bottom} />
  </View>;
}
type P = { vault: Vault; live: Live | null; acts: Activity[] | null; refresh: () => void; go: (t: Tab) => void };

function HomeTab({ vault, live, acts, go }: P) {
  const migrated = !!live?.status?.migrated;
  return <>
    <View style={styles.balance}>
      <Image source={require('./assets/shield-wallet.png')} style={{ position: 'absolute', right: -14, top: 6, width: 130, height: 130, opacity: .9 }} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><T style={{ color: C.onInk2, fontSize: 14 }}>Total balance</T><Pill tone="ink" text={migrated ? 'Native PQ key on' : 'Two locks on'} /></View>
      <T style={{ color: '#fff', fontSize: 64, fontWeight: '600', letterSpacing: -3, marginTop: 14, lineHeight: 70 }}>{near(live?.amount ?? null, 2)}<T style={{ color: C.onInk2, fontSize: 18, fontWeight: '500', letterSpacing: 0 }}>{'\u2002'}NEAR</T></T>
      <T style={{ color: C.onInk2, fontSize: 13.5, marginTop: 6 }}>{vault.wallet}</T>
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 22 }}>
        <View style={{ flex: 1 }}><Btn title="Send" icon={<ArrowUpRight color="#fff" size={18} />} onPress={() => go('send')} /></View>
        <View style={{ flex: 1 }}><Btn title="Receive" kind="ghost" icon={<ArrowDownLeft color="#fff" size={18} />} onPress={() => go('receive')} /></View>
      </View>
    </View>
    <Card>
      <View style={styles.cardHead}><T style={styles.h2}>Your two locks</T><Pressable onPress={() => go('security')}><T style={{ color: C.cobalt, fontWeight: '600' }}>Q-Day switch</T></Pressable></View>
      <LockRow icon={<KeyRound color={C.text2} size={18} />} title="Lock 1 · ed25519" sub="Your existing key. Never enough alone." ok={!!live?.status} />
      <LockRow pq icon={<Atom color={C.cobalt} size={18} />} title="Lock 2 · ML-DSA-65" sub="Post-quantum. Checked on chain." ok={!!live?.status} />
      <LockRow pq icon={<Power color={C.cobalt} size={18} />} title="Native post-quantum key" sub={migrated ? 'On. In NEAR’s key list.' : 'Off. Flip the Q-Day switch.'} ok={migrated} last />
    </Card>
    <Card>
      <View style={styles.cardHead}><T style={styles.h2}>Recent activity</T><Pressable onPress={() => go('activity')}><T style={{ color: C.cobalt, fontWeight: '600' }}>All</T></Pressable></View>
      {acts === null ? <ActivityIndicator style={{ padding: 20 }} /> : acts.length ? acts.slice(0, 4).map(a => <ActRow key={a.hash} a={a} />) : <Empty />}
    </Card>
  </>;
}
const LockRow = ({ icon, title, sub, ok, pq, last }: any) => <View style={[styles.row, last && { borderBottomWidth: 0 }]}>
  <View style={[styles.ico, pq && { backgroundColor: C.cobaltSoft }]}>{icon}</View>
  <View style={{ flex: 1 }}><T style={{ fontWeight: '600', fontSize: 15 }}>{title}</T><T style={{ color: C.text3, fontSize: 12.5, marginTop: 2 }}>{sub}</T></View>
  {ok ? <Check color={C.green} size={19} /> : <Pill text="Off" />}
</View>;
function ActRow({ a }: { a: Activity }) {
  const tone = a.kind === 'refused' ? [C.redSoft, C.red] : a.kind === 'received' ? [C.greenSoft, C.green] : a.kind === 'sent' ? [C.cobaltSoft, C.cobalt] : [C.ink, '#fff'];
  const I = a.kind === 'refused' ? ShieldAlert : a.kind === 'received' ? ArrowDownLeft : a.kind === 'sent' ? ArrowUpRight : a.kind === 'qday' ? Power : ShieldCheck;
  return <Pressable onPress={() => open(a.hash)} style={styles.row}>
    <View style={[styles.ico, { backgroundColor: tone[0] }]}><I color={tone[1]} size={18} /></View>
    <View style={{ flex: 1 }}><T style={{ fontWeight: '600', fontSize: 15 }}>{a.title}</T><T numberOfLines={1} style={{ color: C.text3, fontSize: 12.5, marginTop: 2 }}>{a.detail} · {ago(a.time)}</T></View>
    {a.amount && a.kind !== 'refused' ? <T style={{ fontWeight: '600', color: a.kind === 'received' ? C.green : C.text }}>{a.kind === 'received' ? '+' : '−'}{near(a.amount, 2)}</T> : a.kind === 'refused' ? <Pill text="Refused" tone="red" /> : <Pill text="Done" tone="green" />}
  </Pressable>;
}
const Empty = () => <View style={{ alignItems: 'center', padding: 20, gap: 6 }}><Image source={require('./assets/empty-activity.png')} style={{ width: 96, height: 96 }} /><T style={{ fontWeight: '600' }}>No activity yet</T><T style={{ color: C.text3 }}>Your first payment shows here.</T></View>;

function SendTab({ vault, live, refresh }: P) {
  const [to, setTo] = useState(''); const [amt, setAmt] = useState('');
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
      const r = await execute(vault.relay, vault.wallet, signed);
      setRes(r); setStage('done'); Haptics.notificationAsync(r.success ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error); refresh();
    } catch (e: any) { setErr(friendlyError(String(e.message))); setStage('form'); }
  };
  const signedYet = stage === 'sending' || stage === 'done';
  return <>
    <T style={styles.h1}>Send</T>
    <Card style={{ padding: 18, gap: 14 }}>
      <T style={styles.label}>To</T>
      <TextInput style={styles.input} placeholder="bob.testnet" value={to} onChangeText={setTo} autoCapitalize="none" autoCorrect={false} editable={stage === 'form'} />
      <T style={styles.label}>Amount</T>
      <View style={[styles.input, { flexDirection: 'row', alignItems: 'center', height: 72 }]}>
        <TextInput style={{ flex: 1, fontFamily: F, fontSize: 36, fontWeight: '600', color: C.text }} keyboardType="decimal-pad" placeholder="0" value={amt} onChangeText={t => setAmt(t.replace(/[^\d.]/g, ''))} editable={stage === 'form'} />
        <T style={{ color: C.text3, fontSize: 17, fontWeight: '600' }}>NEAR</T>
      </View>
      <T style={{ color: C.text3, fontSize: 13 }}>Available {near(spendable > 0n ? spendable : 0n, 4)} NEAR</T>
    </Card>
    <View style={[styles.balance, { padding: 16, gap: 10 }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><ShieldCheck color="#fff" size={17} /><T style={{ color: '#fff', fontWeight: '600', fontSize: 15 }}>Signed twice on this phone</T></View>
      <SigRow icon={<KeyRound color={C.onInk} size={16} />} title="ed25519" sub={signedYet ? '64 bytes · signed' : stage === 'signing' ? 'signing…' : 'classical'} done={signedYet} />
      <SigRow pq icon={<Atom color="#b9c8ff" size={16} />} title="ML-DSA-65" sub={signedYet ? '3,309 bytes · signed' : stage === 'signing' ? 'signing…' : 'post-quantum'} done={signedYet} />
    </View>
    {!!err && <View style={[styles.banner, { backgroundColor: C.redSoft }]}><ShieldAlert color={C.red} size={18} /><T style={{ color: '#8e1d22', flex: 1 }}>{err}</T></View>}
    {res && <Pressable onPress={() => open(res.hash)} style={[styles.banner, { backgroundColor: res.success ? C.greenSoft : C.redSoft }]}>
      {res.success ? <ShieldCheck color={C.green} size={20} /> : <ShieldAlert color={C.red} size={20} />}
      <View style={{ flex: 1 }}><T style={{ fontWeight: '600', fontSize: 15.5, color: res.success ? '#0b5c3c' : '#8e1d22' }}>{res.success ? `Sent ${amt} NEAR. NEAR verified both signatures.` : friendlyError(res.error)}</T>
        <T style={{ color: C.cobalt, fontWeight: '600', marginTop: 4 }}>View transaction {short(res.hash)}</T></View>
      {res.success && <Image source={require('./assets/lattice-lock.png')} style={{ width: 54, height: 54 }} />}</Pressable>}
    {stage === 'done' ? <Btn title="New payment" kind="light" onPress={() => { setStage('form'); setRes(null); setAmt(''); }} />
      : <Btn title={stage === 'signing' ? 'Signing with both keys…' : stage === 'sending' ? 'NEAR is checking both…' : 'Sign twice and send'} icon={<ShieldSend size={22} />} busy={stage !== 'form'} disabled={!to || !amt} onPress={send} />}
  </>;
}
const SigRow = ({ icon, title, sub, done, pq }: any) => <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 12, backgroundColor: 'rgba(255,255,255,.06)' }}>
  <View style={[styles.ico, { width: 34, height: 34, backgroundColor: pq ? 'rgba(51,102,255,.25)' : 'rgba(255,255,255,.08)' }]}>{icon}</View>
  <View style={{ flex: 1 }}><T style={{ color: '#fff', fontWeight: '600' }}>{title}</T><T style={{ color: C.onInk2, fontSize: 12.5 }}>{sub}</T></View>
  {done && <Check color="#3ad29f" size={18} />}
</View>;

function ReceiveTab({ vault }: P) {
  const [ok, setOk] = useState(false);
  return <>
    <T style={styles.h1}>Receive</T>
    <View style={[styles.balance, { alignItems: 'center', paddingVertical: 32 }]}>
      <View style={{ backgroundColor: '#fff', padding: 18, borderRadius: 20 }}><QRCode value={vault.wallet} size={210} color={C.ink} /></View>
      <T style={{ color: '#fff', fontSize: 17, fontWeight: '600', marginTop: 20 }}>{vault.wallet}</T>
      <T style={{ color: C.onInk2, fontSize: 13.5, marginTop: 6, textAlign: 'center' }}>Your account name is your address. Receiving needs no signature.</T>
    </View>
    <Btn title={ok ? 'Copied' : 'Copy address'} kind="dark" icon={ok ? <Check color="#fff" size={18} /> : <Copy color="#fff" size={18} />} onPress={async () => { await Clipboard.setStringAsync(vault.wallet); setOk(true); setTimeout(() => setOk(false), 1500); }} />
  </>;
}

function ActivityTab({ acts }: P) {
  return <><T style={styles.h1}>Activity</T><Card>{acts === null ? <ActivityIndicator style={{ padding: 24 }} /> : acts.length ? acts.map(a => <ActRow key={a.hash} a={a} />) : <Empty />}</Card>
    <T style={{ color: C.text3, fontSize: 12.5 }}>From NearBlocks; each wallet action decoded from its on-chain arguments.</T></>;
}

function SecurityTab({ vault, live, refresh, onReset }: P & { onReset: () => void }) {
  const on = !!live?.status?.migrated;
  const [busy, setBusy] = useState(''); const [res, setRes] = useState<{ hash: string; success: boolean; error: string } | null>(null);
  const handle = useMemo(() => pqHandle(publicKeys(vault.keys).pq), [vault]);
  const flip = () => Alert.alert('Turn on the Q-Day switch?', 'Your ML-DSA-65 key becomes a native NEAR full-access key. After this, it alone controls the account at the protocol level.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Turn on', onPress: async () => {
      try {
        setBusy('Signing with both keys…'); await new Promise(r => setTimeout(r, 60));
        const s = await view(vault.wallet);
        const signed = signIntent(makeIntent(vault.wallet, s.nonce, { kind: 'migrate' }), vault.keys);
        setBusy('Adding the native key on NEAR…');
        const r = await execute(vault.relay, vault.wallet, signed); setRes(r);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setTimeout(refresh, 2500);
      } catch (e: any) { setRes({ hash: '', success: false, error: String(e.message) }); } finally { setBusy(''); }
    } }]);
  return <>
    <T style={styles.h1}>Security</T>
    <View style={[styles.balance, { gap: 12 }]}>
      <Image source={require('./assets/lattice-lock.png')} style={{ position: 'absolute', right: -6, top: 8, width: 110, height: 110, opacity: .9 }} />
      <Pill tone={on ? 'blue' : 'ink'} text={on ? 'Switched on' : 'Off'} />
      <T style={{ color: '#fff', fontSize: 24, fontWeight: '600', letterSpacing: -.6, maxWidth: 230 }}>{on ? 'Your post-quantum key is native on NEAR.' : 'Q-Day switch'}</T>
      <T style={{ color: C.onInk2, fontSize: 14.5, lineHeight: 21 }}>{on ? 'NEAR lists your ML-DSA-65 key in the account’s access keys.' : 'One switch adds your ML-DSA-65 key as a native NEAR key. Same account, same balance.'}</T>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, borderRadius: 14, backgroundColor: 'rgba(255,255,255,.06)' }}>
        <Switch value={on} onValueChange={() => !on && flip()} disabled={on || !!busy} trackColor={{ true: C.cobalt, false: '#3a4250' }} />
        <View style={{ flex: 1 }}><T style={{ color: '#fff', fontWeight: '600' }}>{on ? 'Native ML-DSA-65 key: on' : 'Add native ML-DSA-65 key'}</T><T style={{ color: C.onInk2, fontSize: 12.5 }}>{busy || 'Signed with both locks'}</T></View>
        {!!busy && <ActivityIndicator color="#fff" />}
      </View>
      {res?.hash ? <Pressable onPress={() => open(res.hash)}><T style={{ color: '#b9c8ff', fontWeight: '600' }}>{res.success ? 'Switch transaction' : friendlyError(res.error)} {short(res.hash)} ↗</T></Pressable> : null}
    </View>
    <Card>
      <View style={styles.cardHead}><T style={styles.h2}>What NEAR sees</T><Pressable onPress={() => Linking.openURL(`https://testnet.near.rocks/account/${vault.wallet}`)}><ExternalLink color={C.cobalt} size={18} /></Pressable></View>
      {(live?.keys ?? []).map((k, i, a) => <View key={k.publicKey} style={[styles.row, i === a.length - 1 && { borderBottomWidth: 0 }]}>
        <View style={[styles.ico, k.scheme === 'ML-DSA-65' && { backgroundColor: C.cobaltSoft }]}>{k.scheme === 'ML-DSA-65' ? <Atom color={C.cobalt} size={18} /> : <KeyRound color={C.text2} size={18} />}</View>
        <View style={{ flex: 1 }}><T style={{ fontWeight: '600' }}>{k.scheme} · {k.full ? 'full access' : 'execute only'}</T><T numberOfLines={1} style={{ color: C.text3, fontSize: 12, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' }}>{k.publicKey}</T></View>
      </View>)}
      {!on && <View style={[styles.row, { borderBottomWidth: 0 }]}><T style={{ color: C.text3, fontSize: 12.5, flex: 1 }}>After the switch: {short(handle, 22, 6)}</T></View>}
    </Card>
    <Btn title="Remove wallet from this phone" kind="light" onPress={() => Alert.alert('Remove wallet?', 'Keys are deleted from this phone. Without another copy of both keys you lose access.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Remove', style: 'destructive', onPress: onReset }])} />
  </>;
}

const styles = StyleSheet.create({
  btnGlow: { shadowColor: '#3366ff', shadowOpacity: 0.35, shadowRadius: 12, shadowOffset: { width: 0, height: 6 } },
  lockChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, height: 28, borderRadius: 14, backgroundColor: '#ebf0ff' },
  btn: { height: 54, borderRadius: 999, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 18, borderColor: C.line },
  card: { backgroundColor: C.paper, borderRadius: 18, borderWidth: 1, borderColor: C.line, overflow: 'hidden' },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 6 },
  h1: { fontSize: 28, fontWeight: '600', letterSpacing: -.8, marginTop: 4 },
  h2: { fontSize: 17, fontWeight: '600' },
  label: { fontSize: 13.5, fontWeight: '600', color: C.text2 },
  pill: { alignSelf: 'flex-start', paddingHorizontal: 10, height: 24, borderRadius: 999, justifyContent: 'center' },
  balance: { backgroundColor: C.ink, borderRadius: 22, padding: 22, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: '#eef0f3' },
  ico: { width: 40, height: 40, borderRadius: 12, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' },
  top: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, height: 52 },
  tabbar: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', backgroundColor: 'rgba(255,255,255,.97)', borderTopWidth: 1, borderTopColor: C.line, paddingTop: 8 },
  tab: { flex: 1, alignItems: 'center', gap: 3 },
  input: { borderWidth: 1, borderColor: C.line, borderRadius: 14, height: 52, paddingHorizontal: 14, fontFamily: F, fontSize: 16, color: C.text, backgroundColor: C.paper },
  inputDark: { borderWidth: 1, borderColor: 'rgba(255,255,255,.14)', borderRadius: 14, height: 54, paddingHorizontal: 16, fontFamily: F, fontSize: 16, color: '#fff', backgroundColor: 'rgba(255,255,255,.06)' },
  banner: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', padding: 14, borderRadius: 14 },
});
