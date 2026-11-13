// Floating, icon-only tab bar. Thin-line icons, filled when active, a cobalt glow that springs under the
// active icon, and a raised centre "Send" button with Magen's lattice-shield mark. Screen readers get labels.
import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import Svg, { Path, Line } from 'react-native-svg';
import { House, History, ArrowDownLeft, ShieldCheck } from 'lucide-react-native';

export type Tab = 'home' | 'activity' | 'send' | 'receive' | 'security';
const SIDE: { key: Tab; label: string; Icon: any }[] = [
  { key: 'home', label: 'Home', Icon: House },
  { key: 'activity', label: 'Activity', Icon: History },
  { key: 'receive', label: 'Receive', Icon: ArrowDownLeft },
  { key: 'security', label: 'Security and Q-Day switch', Icon: ShieldCheck },
];
const ORDER: Tab[] = ['home', 'activity', 'send', 'receive', 'security'];

/** The quantum-shield mark: a shield whose face is a lattice, with a send arrow. */
export function ShieldSend({ size = 28, color = '#fff' }: { size?: number; color?: string }) {
  return <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
    <Path d="M16 3.5 26 7.2v7.6c0 6.3-4.2 11.2-10 13.7C10.2 26 6 21.1 6 14.8V7.2L16 3.5Z" stroke={color} strokeWidth={1.8} strokeLinejoin="round" />
    <Line x1="11" y1="10" x2="11" y2="21" stroke={color} strokeOpacity={0.45} strokeWidth={1.2} />
    <Line x1="21" y1="10" x2="21" y2="21" stroke={color} strokeOpacity={0.45} strokeWidth={1.2} />
    <Line x1="8.5" y1="15.5" x2="23.5" y2="15.5" stroke={color} strokeOpacity={0.45} strokeWidth={1.2} />
    <Path d="M12.5 19.5 19.5 12.5M14 12.5h5.5V18" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>;
}

export function TabBar({ tab, onChange, bottom }: { tab: Tab; onChange: (t: Tab) => void; bottom: number }) {
  const [w, setW] = useState(0);
  const slot = w / 5;
  const x = useRef(new Animated.Value(0)).current;
  const pop = useRef(new Animated.Value(1)).current;
  const idx = ORDER.indexOf(tab);
  useEffect(() => {
    if (!slot) return;
    Animated.spring(x, { toValue: idx * slot + slot / 2 - 26, useNativeDriver: true, damping: 16, stiffness: 180, mass: 0.8 }).start();
    pop.setValue(0.6); Animated.spring(pop, { toValue: 1, useNativeDriver: true, damping: 10, stiffness: 220 }).start();
  }, [idx, slot]);
  const press = (t: Tab) => { Haptics.impactAsync(t === 'send' ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light); onChange(t); };
  return <View pointerEvents="box-none" style={[s.wrap, { bottom: bottom + 10 }]}>
    <View style={s.bar} onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width)} accessibilityRole="tablist">
      {slot > 0 && tab !== 'send' && <Animated.View style={[s.glow, { transform: [{ translateX: x }, { scale: pop }] }]} />}
      {ORDER.map(k => {
        if (k === 'send') return <View key={k} style={s.slot}>
          <Pressable accessibilityRole="tab" accessibilityLabel="Send, signed twice" accessibilityState={{ selected: tab === 'send' }} onPress={() => press('send')}
            style={({ pressed }) => [s.fab, { transform: [{ scale: pressed ? 0.93 : 1 }] }]}>
            <LinearGradient colors={['#5b84ff', '#2449e0']} start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }} style={s.fabFill}><ShieldSend size={30} /></LinearGradient>
          </Pressable>
        </View>;
        const it = SIDE.find(i => i.key === k)!; const on = tab === k;
        return <Pressable key={k} style={s.slot} accessibilityRole="tab" accessibilityLabel={it.label} accessibilityState={{ selected: on }} onPress={() => press(k)} hitSlop={6}>
          <it.Icon size={24} strokeWidth={on ? 2 : 1.6} color={on ? '#ffffff' : '#7d869a'} fill={on ? 'rgba(143,168,255,0.35)' : 'none'} />
        </Pressable>;
      })}
    </View>
  </View>;
}

const s = StyleSheet.create({
  wrap: { position: 'absolute', left: 20, right: 20, alignItems: 'stretch' },
  bar: { height: 66, borderRadius: 33, backgroundColor: '#0b0e14', flexDirection: 'row', alignItems: 'center', shadowColor: '#0b0e14', shadowOpacity: 0.35, shadowRadius: 22, shadowOffset: { width: 0, height: 12 }, elevation: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  slot: { flex: 1, alignItems: 'center', justifyContent: 'center', height: 66 },
  glow: { position: 'absolute', left: 0, top: 7, width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(51,102,255,0.28)', shadowColor: '#3366ff', shadowOpacity: 0.8, shadowRadius: 14, shadowOffset: { width: 0, height: 0 } },
  fab: { marginTop: -30, width: 66, height: 66, borderRadius: 33, padding: 4, backgroundColor: '#f3f4f6', shadowColor: '#3366ff', shadowOpacity: 0.45, shadowRadius: 16, shadowOffset: { width: 0, height: 8 } },
  fabFill: { flex: 1, borderRadius: 29, alignItems: 'center', justifyContent: 'center' },
});
