// Floating, icon-only tab bar. Thin-line icons, filled when active, a magenta glow that springs under the
// active icon, and a raised centre "Scan" button: Magen's lattice shield with scan brackets inside. Send keeps
// its own slot. Screen readers get labels.
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import Svg, { Path, Line } from 'react-native-svg';
import { House, History, ArrowUpRight, ShieldCheck } from 'lucide-react-native';

/** The five tab-bar tabs, plus screens opened from Home (no tab highlighted). */
export type Tab = 'home' | 'activity' | 'scan' | 'send' | 'security' | 'chains' | 'private' | 'swap';
const SIDE: { key: Tab; label: string; Icon: any }[] = [
  { key: 'home', label: 'Home', Icon: House },
  { key: 'activity', label: 'Activity', Icon: History },
  { key: 'send', label: 'Send', Icon: ArrowUpRight },
  { key: 'security', label: 'Security and Q-Day switch', Icon: ShieldCheck },
];
const ORDER: Tab[] = ['home', 'activity', 'scan', 'send', 'security'];

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

/** The same lattice shield with four scan brackets and a scan line inside: the centre Scan button. */
export function ShieldScan({ size = 28, color = '#fff' }: { size?: number; color?: string }) {
  return <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
    <Path d="M16 3.5 26 7.2v7.6c0 6.3-4.2 11.2-10 13.7C10.2 26 6 21.1 6 14.8V7.2L16 3.5Z" stroke={color} strokeWidth={1.8} strokeLinejoin="round" />
    <Line x1="16" y1="8.5" x2="16" y2="23.5" stroke={color} strokeOpacity={0.35} strokeWidth={1.1} />
    <Line x1="9.5" y1="15.5" x2="22.5" y2="15.5" stroke={color} strokeOpacity={0.35} strokeWidth={1.1} />
    <Path d="M11 13.2v-2.2h2.2M18.8 11H21v2.2M21 18v2.2h-2.2M13.2 20.2H11V18" stroke={color} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" />
    <Line x1="12.3" y1="15.6" x2="19.7" y2="15.6" stroke={color} strokeWidth={2} strokeLinecap="round" />
  </Svg>;
}

export function TabBar({ tab, onChange, bottom }: { tab: Tab; onChange: (t: Tab) => void; bottom: number }) {
  const [w, setW] = useState(0);
  const slot = w / 5;
  const x = useRef(new Animated.Value(0)).current;
  const pop = useRef(new Animated.Value(1)).current;
  const fab = useRef(new Animated.Value(1)).current;
  const halo = useRef(new Animated.Value(0)).current;
  const idx = ORDER.indexOf(tab);
  useEffect(() => {
    if (!slot) return;
    Animated.spring(x, { toValue: idx * slot + slot / 2 - 26, useNativeDriver: true, damping: 16, stiffness: 180, mass: 0.8 }).start();
    pop.setValue(0.6); Animated.spring(pop, { toValue: 1, useNativeDriver: true, damping: 10, stiffness: 220 }).start();
  }, [idx, slot]);
  // On the Scan screen the centre button breathes a soft magenta halo.
  useEffect(() => {
    if (tab !== 'scan') { halo.stopAnimation(); halo.setValue(0); return; }
    fab.setValue(0.82); Animated.spring(fab, { toValue: 1, useNativeDriver: true, damping: 8, stiffness: 260 }).start();
    const loop = Animated.loop(Animated.timing(halo, { toValue: 1, duration: 1800, easing: Easing.out(Easing.quad), useNativeDriver: true }));
    loop.start(); return () => loop.stop();
  }, [tab]);
  const press = (t: Tab) => { Haptics.impactAsync(t === 'scan' ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light); onChange(t); };
  const onScan = tab === 'scan';
  return <View pointerEvents="box-none" style={[s.wrap, { bottom: bottom + 10 }]}>
    <View style={s.bar} onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width)} accessibilityRole="tablist">
      {slot > 0 && !onScan && ORDER.includes(tab) && <Animated.View style={[s.glow, { transform: [{ translateX: x }, { scale: pop }] }]} />}
      {ORDER.map(k => {
        if (k === 'scan') return <View key={k} style={s.slot}>
          {onScan && <Animated.View pointerEvents="none" style={[s.halo, { opacity: halo.interpolate({ inputRange: [0, 1], outputRange: [0.7, 0] }), transform: [{ scale: halo.interpolate({ inputRange: [0, 1], outputRange: [1, 1.55] }) }] }]} />}
          <Pressable accessibilityRole="tab" accessibilityLabel="Scan a code" accessibilityState={{ selected: onScan }} onPress={() => press('scan')}
            onPressIn={() => Animated.spring(fab, { toValue: 0.9, useNativeDriver: true, damping: 14, stiffness: 320 }).start()}
            onPressOut={() => Animated.spring(fab, { toValue: 1, useNativeDriver: true, damping: 8, stiffness: 260 }).start()}>
            <Animated.View style={[s.fab, { backgroundColor: '#0B0C0F', transform: [{ scale: fab }] }]}>
              <LinearGradient colors={['#EE6AD9', '#C930B1']} start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }} style={s.fabFill}><ShieldScan size={31} /></LinearGradient>
            </Animated.View>
          </Pressable>
        </View>;
        const it = SIDE.find(i => i.key === k)!; const on = tab === k;
        return <Pressable key={k} style={s.slot} accessibilityRole="tab" accessibilityLabel={it.label} accessibilityState={{ selected: on }} onPress={() => press(k)} hitSlop={6}>
          <it.Icon size={24} strokeWidth={on ? 2 : 1.6} color={on ? '#ffffff' : 'rgba(255,255,255,0.4)'} fill={on && k !== 'send' ? 'rgba(224,64,200,0.35)' : 'none'} />
        </Pressable>;
      })}
    </View>
  </View>;
}

const s = StyleSheet.create({
  wrap: { position: 'absolute', left: 20, right: 20, alignItems: 'stretch' },
  bar: { height: 66, borderRadius: 33, backgroundColor: '#15171C', flexDirection: 'row', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 22, shadowOffset: { width: 0, height: 12 }, elevation: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  slot: { flex: 1, alignItems: 'center', justifyContent: 'center', height: 66 },
  glow: { position: 'absolute', left: 0, top: 7, width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(224,64,200,0.22)', shadowColor: '#E040C8', shadowOpacity: 0.8, shadowRadius: 14, shadowOffset: { width: 0, height: 0 } },
  fab: { marginTop: -30, width: 66, height: 66, borderRadius: 33, padding: 4, shadowColor: '#E040C8', shadowOpacity: 0.45, shadowRadius: 16, shadowOffset: { width: 0, height: 8 } },
  fabFill: { flex: 1, borderRadius: 29, alignItems: 'center', justifyContent: 'center' },
  halo: { position: 'absolute', top: -15, left: '50%', marginLeft: -33, width: 66, height: 66, borderRadius: 33, borderWidth: 2, borderColor: '#E040C8' },
});
