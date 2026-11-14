// First open: create a wallet from 12 new words, restore one from 12 words, or upgrade a NEAR account you already have.
// The 12 words are hidden behind "Tap to reveal" on every screen that holds them and are never logged.
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import * as SecureStore from 'expo-secure-store';
import * as Haptics from 'expo-haptics';
import { Atom, Check, ChevronLeft, ChevronRight, Eye, EyeOff, KeyRound, LockOpen, ShieldCheck, Sparkles } from 'lucide-react-native';
import { base64, publicKeys, view, type Vault } from '../../../sdk/index.ts';
import { precheckUpgrade, seedFromPrivateKey, upgradeInPlace } from '../../../sdk/upgrade.ts';
import { createWithHelper } from '../../../sdk/drillflow.ts';
import { magenKeysFromMnemonic, nearKey, newMnemonic, validMnemonic } from '../../../sdk/hd.ts';
import { friendlyError, readAccount, short, txUrl } from '../../../web/src/lib/chain.ts';
import { WALLET_WASM_B64 } from './wasm';
import { derived as deriveAll } from './Flows';
import { Btn, Err, Logo, Pill, T, styles } from './ui';
import { C, FONT, LOGO, MONO, TopGlow } from './theme';
import { Linking } from 'react-native';

type Mode = 'intro' | 'create' | 'restore' | 'upgrade';
const NAME = /^[a-z0-9][a-z0-9-]{2,30}$/;

export function Onboarding({ onDone }: { onDone: (v: Vault) => void }) {
  const [mode, setMode] = useState<Mode>('intro');
  return <View style={{ flex: 1, backgroundColor: C.bg }}><TopGlow height={520} /><SafeAreaView style={{ flex: 1 }}>
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      {mode === 'intro' && <Intro set={setMode} />}
      {mode === 'create' && <Create back={() => setMode('intro')} onDone={onDone} />}
      {mode === 'restore' && <Restore back={() => setMode('intro')} onDone={onDone} />}
      {mode === 'upgrade' && <Upgrade back={() => setMode('intro')} onDone={onDone} />}
    </KeyboardAvoidingView>
  </SafeAreaView></View>;
}

/** Scroll body + a footer that holds the one obvious next step. */
function Page({ children, footer, back, step }: { children: any; footer: any; back?: () => void; step?: [number, number] }) {
  return <View style={{ flex: 1 }}>
    <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 12, gap: 14 }} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive">
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 34 }}>
        {back ? <Pressable onPress={back} style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back"><ChevronLeft color={C.text2} size={20} /><T style={{ color: C.text2, fontSize: 15 }}>Back</T></Pressable>
          : <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}><Logo size={34} /><T display style={{ fontSize: 22, letterSpacing: -0.6 }}>magen</T></View>}
        {step && <T style={{ color: C.text3, fontSize: 13 }}>Step {step[0]} of {step[1]}</T>}
      </View>
      {step && <View style={{ height: 4, borderRadius: 2, backgroundColor: C.s2 }}><View style={{ height: 4, borderRadius: 2, backgroundColor: C.accent, width: `${(step[0] / step[1]) * 100}%` }} /></View>}
      {children}
    </ScrollView>
    <View style={{ paddingHorizontal: 24, paddingTop: 8, paddingBottom: 12, gap: 10 }}>{footer}</View>
  </View>;
}

function Intro({ set }: { set: (m: Mode) => void }) {
  return <Page footer={<>
    <Btn title="Get a new wallet" onPress={() => set('create')} icon={<Sparkles color="#fff" size={18} />} />
    <Btn title="I already have one" kind="ghost" onPress={() => set('restore')} icon={<LockOpen color="#fff" size={18} />} />
    <Pressable onPress={() => set('upgrade')} hitSlop={8} accessibilityRole="button"><T style={{ color: C.accentText, fontWeight: '600', textAlign: 'center', paddingVertical: 6 }}>Upgrade a NEAR account I already have</T></Pressable>
    <T style={{ color: C.text3, fontSize: 12.5, textAlign: 'center' }}>NEAR testnet · your keys are made and kept on this phone</T>
  </>}>
    <Image source={require('../assets/art/quantum-lock.png')} style={{ width: 230, height: 230, alignSelf: 'center', marginVertical: 10 }} />
    <T display style={{ fontSize: 33, letterSpacing: -1.2, lineHeight: 38, textAlign: 'center' }}>A wallet with two locks.</T>
    <T style={{ color: C.text2, fontSize: 16, lineHeight: 24, textAlign: 'center' }}>Every payment needs your usual key and a quantum-safe key. NEAR checks both before any money moves.</T>
    <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8 }}><Pill tone="ink" text="ed25519 (today's key)" /><Pill tone="blue" text="+ ML-DSA-65 (quantum-safe)" /></View>
  </Page>;
}

/** The 12 words, masked until tapped. They hide again after 30 s, when the app leaves the screen, or on "Hide". */
export function Words({ words }: { words: string[] }) {
  const [shown, setShown] = useState(false);
  const t = useRef<any>(null);
  useEffect(() => { const s = AppState.addEventListener('change', st => st !== 'active' && setShown(false)); return () => { s.remove(); clearTimeout(t.current); }; }, []);
  const reveal = () => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShown(true); clearTimeout(t.current); t.current = setTimeout(() => setShown(false), 30000); };
  return <View style={{ gap: 10 }}>
    <Pressable onPress={shown ? () => setShown(false) : reveal} accessibilityRole="button" accessibilityLabel={shown ? 'Hide the 12 words' : 'Tap to reveal the 12 words'}
      style={{ borderRadius: 24, borderWidth: 1, borderColor: shown ? C.accentLine : C.line, backgroundColor: C.s1, padding: 14 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {words.map((w, i) => <View key={i} style={{ width: '31%', flexGrow: 1, flexDirection: 'row', alignItems: 'center', gap: 6, height: 40, borderRadius: 14, backgroundColor: C.s2, paddingHorizontal: 10 }}>
          <T style={{ color: C.text3, fontSize: 12, width: 16 }}>{i + 1}</T>
          {shown ? <T style={{ fontFamily: MONO, fontSize: 14 }}>{w}</T> : <View style={{ height: 8, flex: 1, borderRadius: 4, backgroundColor: C.s3 }} />}
        </View>)}
      </View>
      {!shown && <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 18, height: 44, borderRadius: 22, backgroundColor: C.s3, borderWidth: 1, borderColor: C.line2 }}>
          <Eye color="#fff" size={18} /><T style={{ fontWeight: '600' }}>Tap to reveal</T></View></View>}
    </Pressable>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      {shown ? <EyeOff color={C.text3} size={15} /> : <ShieldCheck color={C.text3} size={15} />}
      <T style={{ color: C.text3, fontSize: 12.5, flex: 1 }}>{shown ? 'Tap the words to hide them. They hide by themselves in 30 seconds.' : 'Check that no one, and no camera, can see your screen first.'}</T>
    </View>
  </View>;
}

const Check2 = ({ on, text, onPress }: { on: boolean; text: string; onPress: () => void }) => <Pressable onPress={onPress} accessibilityRole="checkbox" accessibilityState={{ checked: on }} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 20, backgroundColor: C.s1, borderWidth: 1, borderColor: on ? C.accentLine : C.line }}>
  <View style={{ width: 24, height: 24, borderRadius: 8, borderWidth: on ? 0 : 1.5, borderColor: C.line2, backgroundColor: on ? C.accent : 'transparent', alignItems: 'center', justifyContent: 'center' }}>{on && <Check color="#fff" size={15} strokeWidth={3} />}</View>
  <T style={{ flex: 1, fontSize: 15, lineHeight: 21 }}>{text}</T>
</Pressable>;

function Create({ back, onDone }: { back: () => void; onDone: (v: Vault) => void }) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState(''); const [taken, setTaken] = useState<boolean | null>(null);
  const phrase = useMemo(() => newMnemonic(), []);
  const words = useMemo(() => phrase.split(' '), [phrase]);
  const [saved, setSaved] = useState(false);
  const [derived, setDerived] = useState<ReturnType<typeof deriveAll> | null>(null);
  const [busy, setBusy] = useState(''); const [err, setErr] = useState('');
  const [made, setMade] = useState(false);
  const [done, setDone] = useState<{ hash: string; vault: Vault } | null>(null);
  const id = `${name}.testnet`;
  useEffect(() => {
    setTaken(null); if (!NAME.test(name)) return;
    let on = true; const t = setTimeout(() => readAccount(id).then(a => on && setTaken(!!a)).catch(() => on && setTaken(null)), 350);
    return () => { on = false; clearTimeout(t); };
  }, [name]);
  useEffect(() => { if (step === 2 && !derived) setTimeout(() => setDerived(deriveAll(phrase)), 60); }, [step]);
  const create = async () => {
    setErr('');
    try {
      const mk = magenKeysFromMnemonic(phrase); const n = nearKey(phrase);
      if (!made) { setBusy(`Creating ${id} with 10 test NEAR…`); await createWithHelper(id, n.publicKey); setMade(true); }
      setBusy('Approve to add your two locks…');
      const up = await upgradeInPlace(id, n.seed, base64.decode(WALLET_WASM_B64), [n.publicKey], mk.keys.pq, undefined, 'ml-dsa', undefined, mk.feeSeed);
      if (!up.result.success) throw Error(friendlyError(up.result.error));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await SecureStore.setItemAsync('magen-acts-' + id.replace(/[^a-zA-Z0-9._-]/g, '_'), JSON.stringify([{ hash: up.result.hash, time: Date.now(), success: true, kind: 'upgrade', title: 'Wallet created', detail: 'Two locks added: ed25519 + ML-DSA-65' }])).catch(() => {});
      setDone({ hash: up.result.hash, vault: { wallet: id, keys: up.keys, relay: up.fee, mnemonic: phrase } });
    } catch (e: any) { setErr(friendlyError(String(e.message))); } finally { setBusy(''); }
  };
  if (done) return <Page footer={<Btn title="Open my wallet" onPress={() => onDone(done.vault)} icon={<ChevronRight color="#fff" size={18} />} />}>
    <Image source={require('../assets/art/quantum-lock.png')} style={{ width: 180, height: 180, alignSelf: 'center' }} />
    <T display style={{ fontSize: 30, letterSpacing: -1, textAlign: 'center' }}>{id} is ready.</T>
    <T style={{ color: C.text2, fontSize: 15.5, lineHeight: 23, textAlign: 'center' }}>It exists on NEAR testnet with 10 test NEAR, two locks, and an address on every chain, all from your 12 words.</T>
    <Pressable onPress={() => Linking.openURL(txUrl(done.hash))} style={[styles.banner, { backgroundColor: C.accentSoft, borderColor: C.accentLine, alignItems: 'center' }]} accessibilityRole="link">
      <ShieldCheck color={C.accent} size={20} /><View style={{ flex: 1 }}><T style={{ fontWeight: '600' }}>Two locks added on chain</T><T style={{ color: C.accentText, fontWeight: '600', marginTop: 2 }}>View on NEAR Rocks · {short(done.hash)}</T></View></Pressable>
  </Page>;
  const goBack = () => (busy ? null : step ? setStep(step - 1) : back());
  if (step === 0) return <Page back={goBack} step={[1, 4]} footer={<Btn title="Continue" disabled={taken !== false} onPress={() => setStep(1)} />}>
    <T display style={{ fontSize: 30, letterSpacing: -1 }}>Pick a name.</T>
    <T style={{ color: C.text2, fontSize: 15.5, lineHeight: 22 }}>It is your NEAR address. People send to it like an email address.</T>
    <View style={[styles.input, { flexDirection: 'row', alignItems: 'center' }]}>
      <TextInput selectionColor={C.accent} style={{ flex: 1, fontFamily: FONT.m, fontSize: 17, color: C.text }} placeholder="yourname" placeholderTextColor={C.text3} value={name}
        onChangeText={t => setName(t.toLowerCase().replace(/[^a-z0-9-]/g, ''))} autoCapitalize="none" autoCorrect={false} autoFocus accessibilityLabel="Wallet name" />
      <T style={{ color: C.text3, fontSize: 16 }}>.testnet</T></View>
    <T style={{ fontSize: 13.5, color: !name ? C.text3 : taken ? C.redText : taken === false ? C.accentText : C.text3 }}>
      {!name ? '3 to 31 lowercase letters, numbers or hyphens.' : !NAME.test(name) ? 'At least 3 characters, starting with a letter or number.' : taken === null ? 'Checking if it is free…' : taken ? 'Taken. Try another name.' : `${id} is free.`}</T>
  </Page>;
  if (step === 1) return <Page back={goBack} step={[2, 4]} footer={<Btn title="Continue" disabled={!saved} onPress={() => setStep(2)} />}>
    <T display style={{ fontSize: 30, letterSpacing: -1 }}>Your 12 words.</T>
    <T style={{ color: C.text2, fontSize: 15.5, lineHeight: 22 }}>They are your wallet on every chain, including your quantum-safe key. Write them on paper, in order. Anyone with them can take your money; Magen can never recover them.</T>
    <Words words={words} />
    <Check2 on={saved} onPress={() => setSaved(!saved)} text="I wrote the 12 words down, in order, somewhere safe." />
  </Page>;
  if (step === 2) return <Page back={goBack} step={[3, 4]} footer={<Btn title="Continue" disabled={!derived} onPress={() => setStep(3)} />}>
    <T display style={{ fontSize: 30, letterSpacing: -1 }}>Every chain, ready.</T>
    <T style={{ color: C.text2, fontSize: 15.5, lineHeight: 22 }}>Made from your 12 words on this phone. Nothing was sent anywhere yet.</T>
    {!derived ? <View style={{ alignItems: 'center', padding: 30, gap: 10 }}><ActivityIndicator color={C.accent} /><T style={{ color: C.text2 }}>Making your keys…</T></View>
      : <View style={[styles.card]}>
        <View style={[styles.row, { backgroundColor: C.accentSoft }]}><View style={[styles.ico, { backgroundColor: C.accentSoft }]}><Atom color={C.accent} size={18} /></View>
          <View style={{ flex: 1 }}><T style={{ fontWeight: '600' }}>Quantum-safe key</T><T style={{ color: C.text3, fontSize: 12 }}>ML-DSA-65, your second lock</T></View><T style={{ fontFamily: MONO, fontSize: 11.5, color: C.accentText }}>{short(derived.pqHandle.replace('ml-dsa-65-hash:', ''), 6, 4)}</T></View>
        {derived.chains.filter(c => ['near', 'bitcoin', 'zcash', 'ethereum', 'solana', 'base', 'cosmos'].includes(c.id)).map((c, i, a) => <View key={c.id} style={[styles.row, i === a.length - 1 && { borderBottomWidth: 0 }]}>
          <View style={[styles.ico, { backgroundColor: '#fff' }]}>{LOGO[c.id] ? <Image source={LOGO[c.id]} style={{ width: 22, height: 22 }} resizeMode="contain" /> : <T style={{ color: C.bg, fontWeight: '700' }}>{c.name[0]}</T>}</View>
          <View style={{ flex: 1 }}><T style={{ fontWeight: '600' }}>{c.name}</T><T style={{ color: C.text3, fontSize: 12 }}>{c.network}</T></View>
          <T style={{ fontFamily: MONO, fontSize: 11.5, color: C.text2 }}>{c.id === 'near' ? id : short(c.address, 6, 4)}</T></View>)}
      </View>}
  </Page>;
  return <Page back={goBack} step={[4, 4]} footer={<Btn title={busy || (made ? 'Try again: add the two locks' : 'Create my wallet')} busy={!!busy} onPress={create} icon={<ShieldCheck color="#fff" size={18} />} />}>
    <T display style={{ fontSize: 30, letterSpacing: -1 }}>Create {id}</T>
    <T style={{ color: C.text2, fontSize: 15.5, lineHeight: 22 }}>Two steps on NEAR testnet. You approve the second one on the next screen.</T>
    <View style={[styles.card]}>
      {[['1', `Create ${id}`, 'The NEAR testnet helper makes the account and gives it 10 test NEAR (not real money).', made],
        ['2', 'Add your two locks', 'One transaction installs the Magen wallet: today\'s key (ed25519) plus your quantum-safe key (ML-DSA-65). After it, every payment needs both.', false]].map(([n, t, s, ok], i) =>
        <View key={n as string} style={[styles.row, { alignItems: 'flex-start' }, i === 1 && { borderBottomWidth: 0 }]}>
          <View style={[styles.okDot, !ok && { backgroundColor: C.s3 }]}>{ok ? <Check color="#fff" size={14} strokeWidth={3} /> : <T style={{ fontSize: 12, fontWeight: '700' }}>{n as string}</T>}</View>
          <View style={{ flex: 1 }}><T style={{ fontWeight: '600', fontSize: 15 }}>{t as string}</T><T style={{ color: C.text2, fontSize: 13, lineHeight: 19, marginTop: 3 }}>{s as string}</T></View></View>)}
    </View>
    {!!err && <Err text={err} />}
  </Page>;
}

function Restore({ back, onDone }: { back: () => void; onDone: (v: Vault) => void }) {
  const [account, setAccount] = useState(''); const [phrase, setPhrase] = useState('');
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const count = phrase.trim() ? phrase.trim().split(/\s+/).length : 0;
  const go = async () => {
    setErr(''); setBusy(true);
    try {
      const p = phrase.trim().toLowerCase().split(/\s+/).join(' ');
      if (!validMnemonic(p)) throw Error('Those words are not a valid recovery phrase. Check the spelling and order.');
      const id = account.trim().toLowerCase().replace(/\.testnet$/, '') + '.testnet';
      await new Promise(r => setTimeout(r, 30));
      const mk = magenKeysFromMnemonic(p);
      const s = await view(id).catch(() => { throw Error(`${id} is not a Magen wallet on NEAR testnet.`); });
      const pk = publicKeys(mk.keys);
      if (s.ed !== base64.encode(pk.ed) || s.pq !== base64.encode(pk.pq)) throw Error(`These words don't open ${id}.`);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onDone({ wallet: id, keys: mk.keys, relay: { account: id, seed: mk.feeSeed, pq: true }, mnemonic: p });
    } catch (e: any) { setErr(friendlyError(String(e.message))); } finally { setBusy(false); }
  };
  return <Page back={back} footer={<Btn title={busy ? 'Checking your words on NEAR…' : 'Restore my wallet'} busy={busy} disabled={!account || count < 12} onPress={go} />}>
    <T display style={{ fontSize: 30, letterSpacing: -1 }}>Restore with 12 words.</T>
    <T style={{ color: C.text2, fontSize: 15.5, lineHeight: 22 }}>Your words bring back both locks and every chain address. They stay on this phone.</T>
    <T s="label">Wallet name</T>
    <View style={[styles.input, { flexDirection: 'row', alignItems: 'center' }]}>
      <TextInput selectionColor={C.accent} style={{ flex: 1, fontFamily: FONT.m, fontSize: 17, color: C.text }} placeholder="yourname" placeholderTextColor={C.text3} value={account}
        onChangeText={t => setAccount(t.toLowerCase().replace(/\.testnet$/, ''))} autoCapitalize="none" autoCorrect={false} accessibilityLabel="Wallet name" />
      <T style={{ color: C.text3, fontSize: 16 }}>.testnet</T></View>
    <T s="label">Your 12 words</T>
    <TextInput selectionColor={C.accent} style={styles.input} placeholder="Hidden as you type" placeholderTextColor={C.text3} value={phrase} onChangeText={setPhrase}
      autoCapitalize="none" autoCorrect={false} secureTextEntry textContentType="none" autoComplete="off" accessibilityLabel="Your 12 words, hidden" />
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <T style={{ color: count === 12 ? C.accentText : C.text3, fontSize: 13 }}>{count} of 12 words · kept hidden</T>
      <Pressable onPress={async () => setPhrase((await Clipboard.getStringAsync()).trim())} hitSlop={10} accessibilityRole="button"><T style={{ color: C.accentText, fontWeight: '600' }}>Paste</T></Pressable>
    </View>
    {!!err && <Err text={err} />}
  </Page>;
}

function Upgrade({ back, onDone }: { back: () => void; onDone: (v: Vault) => void }) {
  const [account, setAccount] = useState(''); const [secret, setSecret] = useState('');
  const [busy, setBusy] = useState(''); const [err, setErr] = useState('');
  const run = async () => {
    setErr('');
    try {
      const id = account.trim().toLowerCase(); const seed = seedFromPrivateKey(secret);
      const wasm = base64.decode(WALLET_WASM_B64);
      setBusy('Checking the account on NEAR…');
      const c = await precheckUpgrade(id, seed, wasm.length);
      if (!c.ok) throw Error(c.problems.join(' '));
      setBusy('Approve to add the second lock…');
      const up = await upgradeInPlace(id, seed, wasm, c.keys.map(k => k.public_key));
      if (!up.result.success) throw Error(friendlyError(up.result.error));
      onDone({ wallet: id, keys: up.keys, relay: up.fee });
    } catch (e: any) { setErr(friendlyError(String(e.message))); } finally { setBusy(''); }
  };
  return <Page back={back} footer={<Btn title={busy || 'Upgrade in place'} busy={!!busy} onPress={run} disabled={!account || !secret} icon={<KeyRound color="#fff" size={18} />} />}>
    <T display style={{ fontSize: 30, letterSpacing: -1 }}>Upgrade in place.</T>
    <T style={{ color: C.text2, fontSize: 15.5, lineHeight: 22 }}>Same account name, same balance. Your key signs one transaction; it stays your first lock and a new quantum-safe key becomes the second.</T>
    <TextInput selectionColor={C.accent} style={styles.input} placeholder="alice.testnet" placeholderTextColor={C.text3} value={account} onChangeText={setAccount} autoCapitalize="none" autoCorrect={false} accessibilityLabel="Account" />
    <TextInput selectionColor={C.accent} style={styles.input} placeholder="Private key (ed25519:…)" placeholderTextColor={C.text3} value={secret} onChangeText={setSecret} autoCapitalize="none" autoCorrect={false} secureTextEntry textContentType="none" autoComplete="off" accessibilityLabel="Private key, hidden" />
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <T style={{ color: C.text3, fontSize: 12.5, flex: 1 }}>Stays on this phone. It only signs the upgrade.</T>
      <Pressable onPress={async () => setSecret((await Clipboard.getStringAsync()).trim())} hitSlop={10}><T style={{ color: C.accentText, fontWeight: '600' }}>{secret ? 'Key pasted' : 'Paste key'}</T></Pressable>
    </View>
    {!!err && <Err text={err} />}
  </Page>;
}

