// Shared phone UI: the Magen text wrapper, buttons, cards, pills, banners, screen props and styles (W2 dark + magenta).
import { useRef } from 'react';
import { ActivityIndicator, Animated, Image, Linking, Pressable, StyleSheet, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { ChevronLeft, ShieldAlert } from 'lucide-react-native';
import type { Vault } from '../../../sdk/index.ts';
import { txUrl, type Activity, type KeyInfo } from '../../../web/src/lib/chain.ts';
import { C, FONT, T as Txt } from './theme';
import type { Tab } from './TabBar';

export type Live = { amount: bigint | null; storage: number; keys: KeyInfo[]; status: any };
/** A sticky primary action shown above the tab bar (so the bar never covers it). */
export type Action = { title: string; onPress: () => void; busy?: boolean; disabled?: boolean; icon?: any; kind?: 'primary' | 'ghost'; secondary?: { title: string; onPress: () => void } } | null;
export type P = { vault: Vault; live: Live | null; acts: Activity[] | null; actErr?: string; refresh: () => void; go: (t: Tab) => void; receive: () => void; lock: () => void; addLocal: (a: Activity) => void };
export const T = ({ s, style, ...p }: any) => <Txt {...p} style={[s && styles[s as keyof typeof styles], style]} />;
export function Btn({ title, onPress, kind = 'primary', icon, disabled, busy }: { title: string; onPress: () => void; kind?: 'primary' | 'dark' | 'light' | 'ghost'; icon?: any; disabled?: boolean; busy?: boolean }) {
  const bg = kind === 'primary' ? C.accent : kind === 'light' ? 'transparent' : C.s2;
  const sc = useRef(new Animated.Value(1)).current;
  const to = (v: number) => Animated.spring(sc, { toValue: v, useNativeDriver: true, damping: 14, stiffness: 320 }).start();
  return <Pressable onPressIn={() => to(0.96)} onPressOut={() => to(1)} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onPress(); }} disabled={disabled || busy} accessibilityRole="button" accessibilityLabel={title}>
    <Animated.View style={[styles.btn, { backgroundColor: bg, opacity: disabled ? 0.4 : 1, borderWidth: kind === 'primary' ? 0 : 1, borderColor: kind === 'light' ? C.line2 : C.line, transform: [{ scale: sc }] }, kind === 'primary' && styles.btnGlow]}>
      {busy ? <ActivityIndicator color="#fff" /> : icon}<T style={{ color: '#fff', fontWeight: '600', fontSize: 16 }}>{title}</T>
    </Animated.View>
  </Pressable>;
}
export const Card = ({ children, style }: any) => <View style={[styles.card, style]}>{children}</View>;
export const Pill = ({ text, tone = 'gray' }: { text: string; tone?: 'gray' | 'blue' | 'red' | 'green' | 'ink' }) => {
  const m = { gray: [C.s2, C.text2], blue: [C.accentSoft, C.accentText], red: [C.redSoft, C.redText], green: [C.accentSoft, C.accentText], ink: ['rgba(255,255,255,0.08)', C.text] }[tone];
  return <View style={[styles.pill, { backgroundColor: m[0] }]}><T style={{ color: m[1], fontSize: 12, fontWeight: '600' }}>{text}</T></View>;
};
export const Ok = ({ children, onPress }: any) => <Pressable onPress={onPress} style={[styles.banner, { backgroundColor: C.accentSoft, borderColor: C.accentLine }]}>{children}</Pressable>;
export const Err = ({ text }: { text: string }) => <View style={[styles.banner, { backgroundColor: C.redSoft, borderColor: 'rgba(255,90,106,0.3)' }]}><ShieldAlert color={C.red} size={18} /><T style={{ color: C.redText, flex: 1, lineHeight: 20 }}>{text}</T></View>;
export const open = (h: string) => Linking.openURL(txUrl(h));
/** Who pays gas: the execute-only classical key, or, once that key is removed after Q-Day, the native ML-DSA-65 key. */
export const feeSigner = (vault: Vault, live: Live | null) => {
  const edOnChain = live?.keys.some(k => k.scheme === 'ed25519');
  return edOnChain === false && live?.status?.migrated ? { account: vault.wallet, seed: vault.keys.pq, pq: true } : vault.relay;
};
export const Logo = ({ size = 30 }: { size?: number }) => <Image source={require('../assets/logo.png')} style={{ width: size, height: size }} accessibilityLabel="Magen" />;

export const Tile = ({ icon, title, onPress }: any) => <Pressable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onPress(); }} style={({ pressed }) => [styles.tile, { transform: [{ scale: pressed ? 0.96 : 1 }] }]} accessibilityRole="button" accessibilityLabel={title}>
  <View style={[styles.ico, { backgroundColor: C.accentSoft }]}>{icon}</View><T style={{ fontWeight: '600', fontSize: 14 }}>{title}</T></Pressable>;
/** iOS-style nav: a round back chevron, then the large title. No explainer paragraph (footnotes live by the CTA). */
export const Back = ({ go, title }: any) => <View style={{ gap: 10, paddingTop: 2 }}>
  <Pressable onPress={() => go('home')} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back" style={({ pressed }) => ({ width: 38, height: 38, borderRadius: 19, backgroundColor: C.s2, borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center', transform: [{ scale: pressed ? 0.94 : 1 }] })}><ChevronLeft color={C.text} size={20} /></Pressable>
  <T s="h1">{title}</T></View>;
export const feeOf = (vault: Vault, live: Live | null) => live?.keys.some(k => k.scheme === 'ed25519') === false && live?.status?.migrated ? { account: vault.wallet, seed: vault.keys.pq, pq: true } : vault.relay;

export const styles = StyleSheet.create({
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
