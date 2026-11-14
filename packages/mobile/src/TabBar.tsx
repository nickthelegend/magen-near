// Floating, icon-only tab bar. Thin-line icons, filled when active, a magenta glow that springs under the
// active icon, and a raised centre "Scan" button: Magen's lattice shield with scan brackets inside. Send keeps
// its own slot. Screen readers get labels.
import { Pressable, StyleSheet, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import Svg, { Path, Line } from 'react-native-svg';
import { Wallet, Clock, Compass, ShieldCheck } from 'lucide-react-native';

/** The five tab-bar tabs, plus screens opened from Home (no tab highlighted). */
export type Tab = 'home' | 'activity' | 'scan' | 'send' | 'security' | 'chains' | 'private' | 'swap' | 'receive' | 'bridge' | 'settings';


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

/** Edge-to-edge bottom bar: four icons, the active one magenta inside a soft rounded-square tint. */
const TABS: { key: Tab; label: string; Icon: any }[] = [
  { key: 'home', label: 'Wallet', Icon: Wallet },
  { key: 'activity', label: 'Activity', Icon: Clock },
  { key: 'bridge', label: 'Bridge', Icon: Compass },
  { key: 'security', label: 'Security and Q-Day switch', Icon: ShieldCheck },
];
export const TAB_H = 58;
export function TabBar({ tab, onChange, bottom }: { tab: Tab; onChange: (t: Tab) => void; bottom: number }) {
  return <View style={[s.bar, { paddingBottom: bottom, height: TAB_H + bottom }]} accessibilityRole="tablist">
    {TABS.map(({ key, label, Icon }) => { const on = tab === key;
      return <Pressable key={key} style={s.slot} accessibilityRole="tab" accessibilityLabel={label} accessibilityState={{ selected: on }} hitSlop={4}
        onPress={() => { Haptics.selectionAsync(); onChange(key); }}>
        <View style={[s.pad, on && s.on]}><Icon size={24} strokeWidth={on ? 2.2 : 1.8} color={on ? '#E040C8' : 'rgba(255,255,255,0.6)'} fill={on && key !== 'activity' && key !== 'bridge' ? 'rgba(224,64,200,0.3)' : 'none'} /></View>
      </Pressable>; })}
  </View>;
}

const s = StyleSheet.create({
  bar: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', backgroundColor: '#0E0F13', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.14)' },
  slot: { flex: 1, height: TAB_H, alignItems: 'center', justifyContent: 'center' },
  pad: { width: 52, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  on: { backgroundColor: 'rgba(224,64,200,0.16)' },
});
