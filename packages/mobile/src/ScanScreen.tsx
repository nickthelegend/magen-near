// Scan screen: a full-screen camera QR scanner under an animated lattice frame (torch, scan from photo, paste),
// and "My code": Magen's lattice QR for receiving, inside an orbiting quantum border. What a code means is
// decided by src/scan.ts; the wallet routes the result (Send prefilled, pay confirmation, or a clear error).
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, Share, StyleSheet, TextInput, View, useWindowDimensions } from 'react-native';
import { CameraView, scanFromURLAsync, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import Svg, { Circle, Defs, Pattern, Rect, SvgXml } from 'react-native-svg';
import { Atom, Check, ClipboardPaste, Copy, Flashlight, FlashlightOff, Image as ImageIcon, Share2, ShieldAlert, X } from 'lucide-react-native';
import { magenQr } from './qr';
import { checkAmount, payLink, receiveCode, MAX_MEMO, type Scanned } from './scan';
import { ShieldScan, ShieldSend } from './TabBar';
import { C as K, FONT, T as Txt } from './theme';

const F = FONT.m;
const C = { ink: K.bg, onInk: K.text, onInk2: K.text2, cobalt: K.accent, soft: K.accentText, red: K.red, redSoft: K.redSoft, text: K.text, text2: K.text2, text3: K.text3, line: K.line };
const T = (p: any) => <Txt {...p} />;
export type ScanMode = 'scan' | 'code';
export type Sheet = Extract<Scanned, { kind: 'pay' } | { kind: 'error' }>;

const useLoop = (ms: number, delay = 0, easing = Easing.linear) => {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const a = Animated.loop(Animated.sequence([Animated.timing(v, { toValue: 1, duration: ms, easing, useNativeDriver: true }), Animated.delay(delay), Animated.timing(v, { toValue: 0, duration: 0, useNativeDriver: true })]));
    a.start(); return () => a.stop();
  }, []);
  return v;
};

/** Faint lattice of dots and bonds, Magen's background motif. */
const Lattice = ({ opacity = 1 }: { opacity?: number }) => <Svg style={StyleSheet.absoluteFill} pointerEvents="none" opacity={opacity}>
  <Defs><Pattern id="lat" width="24" height="24" patternUnits="userSpaceOnUse">
    <Rect x="11.5" y="0" width="1" height="24" fill="rgba(242,139,224,0.07)" /><Rect x="0" y="11.5" width="24" height="1" fill="rgba(242,139,224,0.07)" />
    <Circle cx="12" cy="12" r="1.5" fill="rgba(242,139,224,0.28)" /></Pattern></Defs>
  <Rect width="100%" height="100%" fill="url(#lat)" />
</Svg>;

function Segment({ mode, onChange }: { mode: ScanMode; onChange: (m: ScanMode) => void }) {
  const x = useRef(new Animated.Value(mode === 'scan' ? 0 : 1)).current;
  useEffect(() => { Animated.spring(x, { toValue: mode === 'scan' ? 0 : 1, useNativeDriver: true, damping: 15, stiffness: 220 }).start(); }, [mode]);
  return <View style={s.seg} accessibilityRole="tablist">
    <Animated.View style={[s.segKnob, { transform: [{ translateX: x.interpolate({ inputRange: [0, 1], outputRange: [0, 112] }) }] }]} />
    {(['scan', 'code'] as const).map(m => <Pressable key={m} style={s.segItem} accessibilityRole="tab" accessibilityState={{ selected: mode === m }} onPress={() => { Haptics.selectionAsync(); onChange(m); }}>
      <T style={{ fontWeight: '600', fontSize: 14.5, color: mode === m ? '#fff' : C.onInk2 }}>{m === 'scan' ? 'Scan' : 'My code'}</T>
    </Pressable>)}
  </View>;
}

const Glass = ({ title, icon, onPress, label }: any) => <Pressable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onPress(); }} accessibilityRole="button" accessibilityLabel={label ?? title}
  style={({ pressed }) => [s.glass, { transform: [{ scale: pressed ? 0.95 : 1 }] }]}>{icon}<T style={{ fontWeight: '600', fontSize: 15 }}>{title}</T></Pressable>;

export function ScanScreen({ wallet, mode, setMode, sheet, onCode, onConfirm, onDismiss, top, bottom }: {
  wallet: string; mode: ScanMode; setMode: (m: ScanMode) => void; sheet: Sheet | null;
  onCode: (raw: string) => void; onConfirm: (p: Extract<Scanned, { kind: 'pay' }>) => void; onDismiss: () => void; top: number; bottom: number;
}) {
  return <View style={StyleSheet.absoluteFill}>
    <StatusBar style="light" />
    {mode === 'scan' ? <Scanner sheet={sheet} onCode={onCode} top={top} /> : <MyCode wallet={wallet} top={top} bottom={bottom} />}
    <View style={[s.head, { top: top + 8 }]} pointerEvents="box-none"><Segment mode={mode} onChange={setMode} /></View>
    {sheet && mode === 'scan' && <ResultSheet sheet={sheet} onConfirm={onConfirm} onDismiss={onDismiss} bottom={bottom} />}
  </View>;
}

/* ---------- camera scanner ---------- */
function Scanner({ sheet, onCode, top }: { sheet: Sheet | null; onCode: (raw: string) => void; top: number }) {
  const { width, height } = useWindowDimensions();
  const [perm, requestPerm] = useCameraPermissions();
  const [ready, setReady] = useState(false); const [noCam, setNoCam] = useState(''); const [torch, setTorch] = useState(false);
  const [busy, setBusy] = useState(''); const [note, setNote] = useState('');
  const lock = useRef(false);
  useEffect(() => { if (!sheet) lock.current = false; }, [sheet]);
  useEffect(() => { if (perm && !perm.granted && perm.canAskAgain) requestPerm(); }, [perm?.granted, perm?.canAskAgain]);
  // A Simulator (or a phone with the camera busy) never reports ready: say so instead of showing black.
  useEffect(() => { if (ready) return; const t = setTimeout(() => setNoCam(n => n || 'No camera here. Scan a QR from a photo or paste one.'), 2200); return () => clearTimeout(t); }, [ready]);
  const got = (raw: string) => { if (lock.current) return; lock.current = true; Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); onCode(raw); };
  const fromPhoto = async () => {
    setNote('');
    try {
      const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1, allowsEditing: false });
      if (r.canceled || !r.assets?.[0]) return;
      setBusy('Reading the code…');
      const found = await scanFromURLAsync(r.assets[0].uri, ['qr']);
      if (!found.length) { setNote('No QR code found in that photo. Try a sharper or closer image.'); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); return; }
      lock.current = false; got(found[0].data);
    } catch (e: any) { setNote(`Couldn't read that photo: ${String(e?.message ?? e)}`); } finally { setBusy(''); }
  };
  const paste = async () => {
    setNote('');
    const t = await Clipboard.getStringAsync();
    if (!t.trim()) { setNote('The clipboard is empty. Copy an account or a Magen pay link first.'); return; }
    lock.current = false; got(t);
  };
  const F_ = Math.min(width - 104, 268); const fx = (width - F_) / 2; const fy = top + 150;
  const granted = !!perm?.granted;
  const denied = perm && !perm.granted && !perm.canAskAgain;
  const status = busy || note || (denied ? 'Camera access is off. Allow it in Settings, or scan from a photo.' : !ready && noCam ? noCam : 'Point at a NEAR account or a Magen pay code');
  const dim = 'rgba(5,6,8,0.66)';
  return <View style={[StyleSheet.absoluteFill, { backgroundColor: C.ink }]}>
    <LinearGradient colors={['#0B0C0F', '#1A0E19', '#0B0C0F']} locations={[0, 0.45, 1]} style={StyleSheet.absoluteFill} />
    <Lattice />
    {granted && <CameraView style={StyleSheet.absoluteFill} facing="back" enableTorch={torch} barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
      onCameraReady={() => { setReady(true); setNoCam(''); }} onMountError={e => setNoCam(`Camera unavailable: ${e.message}`)}
      onBarcodeScanned={sheet ? undefined : ({ data }) => got(data)} />}
    {/* dim everything but the frame */}
    <View pointerEvents="none" style={[s.dim, { backgroundColor: ready ? dim : 'transparent', top: 0, height: fy }]} />
    <View pointerEvents="none" style={[s.dim, { backgroundColor: ready ? dim : 'transparent', top: fy + F_, bottom: 0 }]} />
    <View pointerEvents="none" style={[s.dim, { backgroundColor: ready ? dim : 'transparent', top: fy, height: F_, width: fx }]} />
    <View pointerEvents="none" style={[s.dim, { backgroundColor: ready ? dim : 'transparent', top: fy, height: F_, left: fx + F_, right: 0 }]} />
    <View pointerEvents="none" style={{ position: 'absolute', top: top + 74, left: 24, right: 24, alignItems: 'center' }}>
      <T display style={{ fontSize: 28, letterSpacing: -0.9 }}>Scan to pay</T>
      <T style={{ color: C.onInk2, fontSize: 14, marginTop: 4 }}>NEAR account · Magen pay code · magen:// link</T>
    </View>
    <Frame x={fx} y={fy} size={F_} live={ready && !sheet} />
    {granted && <Pressable onPress={() => setTorch(t => !t)} disabled={!ready} accessibilityRole="button" accessibilityLabel={torch ? 'Turn torch off' : 'Turn torch on'}
      style={[s.torch, { top: top + 10, opacity: ready ? 1 : 0.45, backgroundColor: torch ? '#fff' : 'rgba(255,255,255,0.1)' }]} hitSlop={8}>
      {torch ? <Flashlight color={C.ink} size={19} /> : <FlashlightOff color="#fff" size={19} />}
    </Pressable>}
    {!sheet && <View style={{ position: 'absolute', top: fy + F_ + 26, left: 20, right: 20, alignItems: 'center', gap: 16 }}>
      <T style={{ color: note ? '#FFB3BA' : C.onInk2, fontSize: 13.5, textAlign: 'center', lineHeight: 19 }}>{status}</T>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Glass title="Scan from photo" icon={<ImageIcon color="#fff" size={18} />} onPress={fromPhoto} />
        <Glass title="Paste" icon={<ClipboardPaste color="#fff" size={18} />} onPress={paste} label="Paste a code from the clipboard" />
      </View>
      {denied && <Pressable onPress={() => Linking.openSettings()}><T style={{ color: C.soft, fontWeight: '600' }}>Open Settings</T></Pressable>}
    </View>}
  </View>;
}

/** The animated scan frame: glowing lattice corners that breathe, a lattice grid, a sweeping beam and orbiting quanta. */
function Frame({ x, y, size, live }: { x: number; y: number; size: number; live: boolean }) {
  const beam = useLoop(2100, 250, Easing.inOut(Easing.cubic));
  const breathe = useLoop(1600, 0, Easing.inOut(Easing.sin));
  const orbit = useLoop(9000); const orbit2 = useLoop(14000);
  const B = 34; const k = 4;
  const corner = (st: any) => <View style={[s.corner, { width: B, height: B }, st]} />;
  const O = size + 54;
  const spin = (v: Animated.Value, rev = false) => ({ transform: [{ rotate: v.interpolate({ inputRange: [0, 1], outputRange: rev ? ['360deg', '0deg'] : ['0deg', '360deg'] }) }] });
  return <View pointerEvents="none" style={{ position: 'absolute', left: x, top: y, width: size, height: size }}>
    <Animated.View style={[s.orbit, { width: O, height: O, borderRadius: O / 2, left: -27, top: -27 }, spin(orbit)]}>
      <View style={[s.quant, { left: O / 2 - 4, top: -4 }]} /><View style={[s.quant, { left: O / 2 - 3, bottom: -3, width: 6, height: 6, opacity: 0.7 }]} />
    </Animated.View>
    <Animated.View style={[{ position: 'absolute', width: O, height: O, left: -27, top: -27 }, spin(orbit2, true)]}>
      <View style={[s.quant, { left: -3, top: O / 2 - 3, width: 6, height: 6, backgroundColor: '#F6B5EB' }]} />
    </Animated.View>
    <View style={[StyleSheet.absoluteFill, { borderRadius: 26, overflow: 'hidden' }]}>
      <Lattice opacity={0.9} />
      {live && <Animated.View style={{ position: 'absolute', left: 0, right: 0, height: 72, transform: [{ translateY: beam.interpolate({ inputRange: [0, 1], outputRange: [-72, size] }) }] }}>
        <LinearGradient colors={['rgba(224,64,200,0)', 'rgba(224,64,200,0.38)']} style={{ flex: 1 }} />
        <View style={{ height: 2, backgroundColor: '#F6B5EB', shadowColor: '#E040C8', shadowOpacity: 1, shadowRadius: 8 }} />
      </Animated.View>}
      {!live && <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}><View style={{ opacity: 0.85 }}><ShieldScan size={78} color="#F28BE0" /></View></View>}
    </View>
    <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ scale: breathe.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1.035, 1] }) }] }]}>
      {corner({ left: -k, top: -k, borderLeftWidth: k, borderTopWidth: k, borderTopLeftRadius: 26 })}
      {corner({ right: -k, top: -k, borderRightWidth: k, borderTopWidth: k, borderTopRightRadius: 26 })}
      {corner({ left: -k, bottom: -k, borderLeftWidth: k, borderBottomWidth: k, borderBottomLeftRadius: 26 })}
      {corner({ right: -k, bottom: -k, borderRightWidth: k, borderBottomWidth: k, borderBottomRightRadius: 26 })}
    </Animated.View>
  </View>;
}

/* ---------- result sheet ---------- */
function ResultSheet({ sheet, onConfirm, onDismiss, bottom }: { sheet: Sheet; onConfirm: (p: any) => void; onDismiss: () => void; bottom: number }) {
  const y = useRef(new Animated.Value(60)).current; const o = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.parallel([Animated.spring(y, { toValue: 0, useNativeDriver: true, damping: 16, stiffness: 200 }), Animated.timing(o, { toValue: 1, duration: 180, useNativeDriver: true })]).start(); }, [sheet]);
  const Row = ({ k, v, big }: any) => <View style={s.row}><T style={{ color: C.text3, fontSize: 13.5, width: 70 }}>{k}</T><T style={{ color: C.text, flex: 1, fontWeight: '600', fontSize: big ? 22 : 15.5, textAlign: 'right' }} numberOfLines={big ? 1 : 2}>{v}</T></View>;
  return <Animated.View style={[s.sheet, { bottom: bottom + 110, opacity: o, transform: [{ translateY: y }] }]}>
    {sheet.kind === 'pay' ? <>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        <View style={s.sheetIco}><ShieldSend size={22} /></View>
        <View style={{ flex: 1 }}><T style={{ color: C.text, fontWeight: "700", fontSize: 18 }}>Pay request</T><T style={{ color: C.text3, fontSize: 12.5 }}>{sheet.via === 'https' ? 'Magen link' : 'Magen code'} · NEAR testnet</T></View>
        <Pressable onPress={onDismiss} hitSlop={10} accessibilityLabel="Dismiss"><X color={C.text3} size={20} /></Pressable>
      </View>
      <Row k="To" v={sheet.to} />
      <Row k="Amount" v={sheet.amount ? `${sheet.amount} NEAR` : 'You choose'} big={!!sheet.amount} />
      {!!sheet.memo && <Row k="Memo" v={sheet.memo} />}
      {!!sheet.memo && <T style={{ color: C.text3, fontSize: 12, marginTop: 2 }}>The memo is shown to you only; it isn't written on chain.</T>}
      <Pressable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onConfirm(sheet); }} accessibilityRole="button" style={({ pressed }) => [s.primary, { transform: [{ scale: pressed ? 0.97 : 1 }] }]}>
        <ShieldSend size={21} /><T style={{ fontWeight: '600', fontSize: 16 }}>Review and sign twice</T>
      </Pressable>
    </> : <>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
        <View style={[s.sheetIco, { backgroundColor: C.redSoft }]}><ShieldAlert color={C.red} size={20} /></View>
        <View style={{ flex: 1 }}><T style={{ color: C.text, fontWeight: '700', fontSize: 17 }}>{sheet.code === 'self' ? 'That’s your own code' : sheet.code === 'dapp' ? 'dApp request' : 'Can’t use this code'}</T>
          <T style={{ color: C.text2, fontSize: 14.5, lineHeight: 20, marginTop: 4 }}>{sheet.message}</T></View>
      </View>
      <Pressable onPress={onDismiss} accessibilityRole="button" style={({ pressed }) => [s.primary, { backgroundColor: '#1D2027', shadowOpacity: 0, transform: [{ scale: pressed ? 0.97 : 1 }] }]}>
        <T style={{ fontWeight: '600', fontSize: 16 }}>Scan again</T>
      </Pressable>
    </>}
  </Animated.View>;
}

/* ---------- my code ---------- */
function MyCode({ wallet, top, bottom }: { wallet: string; top: number; bottom: number }) {
  const { width } = useWindowDimensions();
  const [amount, setAmount] = useState(''); const [memo, setMemo] = useState(''); const [copied, setCopied] = useState(false);
  const valid = checkAmount(amount);
  const value = receiveCode(wallet, valid ?? undefined, memo);
  const qr = useMemo(() => magenQr(value).svg, [value]);
  const Q = Math.min(width - 132, 236);
  const card = Q + 30; const O = card + 64;
  const beam = useLoop(4200); const sheen = useLoop(2400, 1800, Easing.inOut(Easing.quad));
  const orbit = useLoop(8000); const orbit2 = useLoop(12500);
  const pulse = useLoop(2600, 0, Easing.inOut(Easing.sin));
  const swap = useRef(new Animated.Value(1)).current;
  useEffect(() => { swap.setValue(0.94); Animated.spring(swap, { toValue: 1, useNativeDriver: true, damping: 11, stiffness: 240 }).start(); }, [value]);
  const spin = (v: Animated.Value, rev = false) => ({ transform: [{ rotate: v.interpolate({ inputRange: [0, 1], outputRange: rev ? ['360deg', '0deg'] : ['0deg', '360deg'] }) }] });
  const isRequest = value !== wallet;
  const link = isRequest ? payLink(wallet, valid ?? undefined, memo) : wallet;
  const share = () => Share.share({ message: isRequest ? `Pay me${valid ? ` ${valid} NEAR` : ''} with Magen on NEAR testnet: ${link}` : `My NEAR testnet account (Magen, signed twice): ${wallet}` }).catch(() => {});
  const copy = async () => { await Clipboard.setStringAsync(link); setCopied(true); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); setTimeout(() => setCopied(false), 1500); };
  return <View style={[StyleSheet.absoluteFill, { backgroundColor: C.ink }]}>
    <LinearGradient colors={['#0B0C0F', '#1E0F1C', '#0B0C0F']} locations={[0, 0.4, 1]} style={StyleSheet.absoluteFill} />
    <Lattice />
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ paddingTop: top + 70, paddingBottom: bottom + 10 + 66 + 30 + 16, alignItems: 'center', paddingHorizontal: 20 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={{ width: O, height: O, alignItems: 'center', justifyContent: 'center' }}>
          <Animated.View pointerEvents="none" style={[s.aura, { width: card + 30, height: card + 30, borderRadius: 40, opacity: pulse.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.35, 0.8, 0.35] }) }]} />
          <Svg pointerEvents="none" width={O} height={O} style={StyleSheet.absoluteFill}><Circle cx={O / 2} cy={O / 2} r={O / 2 - 2} stroke="rgba(242,139,224,0.22)" strokeWidth={1} strokeDasharray="2 7" fill="none" /></Svg>
          <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, spin(orbit)]}>
            <View style={[s.quant, { left: O / 2 - 5, top: -3, width: 10, height: 10, borderRadius: 5 }]} />
            <View style={[s.quant, { left: O / 2 - 3, bottom: -1, opacity: 0.6 }]} />
          </Animated.View>
          <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, spin(orbit2, true)]}>
            <View style={[s.quant, { left: -1, top: O / 2 - 3, backgroundColor: '#F6B5EB' }]} />
            <View style={[s.quant, { right: -1, top: O / 2 - 2, width: 5, height: 5, opacity: 0.7 }]} />
          </Animated.View>
          <Animated.View style={{ width: card + 6, height: card + 6, borderRadius: 31, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(224,64,200,0.28)', transform: [{ scale: swap }] }}>
            <Animated.View style={[{ position: 'absolute', width: card * 1.6, height: card * 1.6 }, spin(beam)]}>
              <LinearGradient colors={['rgba(224,64,200,0)', '#E040C8', '#FCE1F7', '#E040C8', 'rgba(224,64,200,0)']} locations={[0.3, 0.46, 0.5, 0.54, 0.7]} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={{ flex: 1 }} />
            </Animated.View>
            <View style={{ width: card, height: card, borderRadius: 28, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
              <SvgXml xml={qr} width={Q} height={Q} accessibilityLabel={`QR code for ${value}`} />
              <Animated.View pointerEvents="none" style={{ position: 'absolute', top: -card * 0.3, bottom: -card * 0.3, width: 70, transform: [{ translateX: sheen.interpolate({ inputRange: [0, 1], outputRange: [-card, card] }) }, { rotate: '18deg' }] }}>
                <LinearGradient colors={['rgba(246,181,235,0)', 'rgba(246,181,235,0.30)', 'rgba(246,181,235,0)']} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={{ flex: 1 }} />
              </Animated.View>
            </View>
          </Animated.View>
        </View>
        <T style={{ fontSize: 19, fontWeight: '600', marginTop: 6, textAlign: 'center' }} numberOfLines={1} adjustsFontSizeToFit>{wallet}</T>
        <View style={s.badge}><Atom color="#F6B5EB" size={14} /><T style={{ color: '#FBD3F4', fontSize: 12.5, fontWeight: '600' }}>Signed twice · ed25519 + ML-DSA-65</T></View>
        <View style={{ alignSelf: 'stretch', gap: 10, marginTop: 18 }}>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={[s.input, { flex: 1, flexDirection: 'row', alignItems: 'center', paddingRight: 12 }, amount && !valid ? { borderColor: '#FF5A6A' } : null]}>
              <TextInput selectionColor="#E040C8" style={{ flex: 1, fontFamily: F, fontSize: 16, color: '#fff' }} placeholder="Amount" placeholderTextColor={C.onInk2} keyboardType="decimal-pad" value={amount} onChangeText={t => setAmount(t.replace(/[^\d.]/g, ''))} accessibilityLabel="Amount to request in NEAR, optional" />
              <T style={{ color: C.onInk2, fontWeight: '600', fontSize: 13 }}>NEAR</T>
            </View>
            <TextInput selectionColor="#E040C8" style={[s.input, { flex: 1.25, fontFamily: F, fontSize: 16, color: '#fff' }]} placeholder="Memo" placeholderTextColor={C.onInk2} value={memo} onChangeText={t => setMemo(t.slice(0, MAX_MEMO))} accessibilityLabel="Memo shown to the payer, optional" />
          </View>
          <T style={{ color: amount && !valid ? '#FFB3BA' : C.onInk2, fontSize: 12.5, textAlign: 'center' }}>{amount && !valid ? 'Enter a number above 0, up to 24 decimals.' : isRequest ? 'Pay request: Magen opens it ready to sign twice.' : 'Your account is your address. Add an amount to request one.'}</T>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
            <Pressable onPress={share} accessibilityRole="button" style={({ pressed }) => [s.primary, { flex: 1, marginTop: 0, transform: [{ scale: pressed ? 0.96 : 1 }] }]}><Share2 color="#fff" size={18} /><T style={{ fontWeight: '600', fontSize: 16 }}>Share</T></Pressable>
            <Pressable onPress={copy} accessibilityRole="button" accessibilityLabel={isRequest ? 'Copy pay link' : 'Copy address'} style={({ pressed }) => [s.glass, { flex: 1, height: 54, justifyContent: 'center', transform: [{ scale: pressed ? 0.96 : 1 }] }]}>
              {copied ? <Check color="#fff" size={18} /> : <Copy color="#fff" size={18} />}<T style={{ fontWeight: '600', fontSize: 16 }}>{copied ? 'Copied' : isRequest ? 'Copy link' : 'Copy'}</T></Pressable>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  </View>;
}

const s = StyleSheet.create({
  head: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  seg: { width: 232, height: 44, borderRadius: 22, padding: 4, flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  segKnob: { position: 'absolute', left: 4, top: 4, width: 112, height: 34, borderRadius: 17, backgroundColor: '#E040C8', shadowColor: '#E040C8', shadowOpacity: 0.7, shadowRadius: 10, shadowOffset: { width: 0, height: 0 } },
  segItem: { width: 112, height: 34, alignItems: 'center', justifyContent: 'center' },
  dim: { position: 'absolute', left: 0, right: 0 },
  corner: { position: 'absolute', borderColor: '#F28BE0', shadowColor: '#E040C8', shadowOpacity: 0.9, shadowRadius: 10, shadowOffset: { width: 0, height: 0 } },
  orbit: { position: 'absolute', borderWidth: 1, borderColor: 'rgba(242,139,224,0.16)', borderStyle: 'dashed' },
  quant: { position: 'absolute', width: 8, height: 8, borderRadius: 4, backgroundColor: '#F28BE0', shadowColor: '#E040C8', shadowOpacity: 1, shadowRadius: 8, shadowOffset: { width: 0, height: 0 } },
  torch: { position: 'absolute', right: 20, width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  glass: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 48, paddingHorizontal: 18, borderRadius: 999, backgroundColor: '#1D2027', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  sheet: { position: 'absolute', left: 14, right: 14, backgroundColor: '#15171C', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', borderRadius: 28, padding: 18, gap: 4, shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 30, shadowOffset: { width: 0, height: 14 } },
  sheetIco: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#E040C8', alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)' },
  primary: { marginTop: 14, height: 54, borderRadius: 999, backgroundColor: '#E040C8', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, shadowColor: '#E040C8', shadowOpacity: 0.35, shadowRadius: 12, shadowOffset: { width: 0, height: 6 } },
  aura: { position: 'absolute', backgroundColor: 'rgba(224,64,200,0.25)', shadowColor: '#E040C8', shadowOpacity: 1, shadowRadius: 40, shadowOffset: { width: 0, height: 0 } },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, paddingHorizontal: 12, height: 28, borderRadius: 14, backgroundColor: 'rgba(224,64,200,0.22)', borderWidth: 1, borderColor: 'rgba(242,139,224,0.3)' },
  input: { height: 52, borderRadius: 999, paddingHorizontal: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', backgroundColor: '#1D2027' },
});
