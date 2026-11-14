// One scrolling screen above the floating tab bar, with an optional sticky action area that always sits ABOVE the
// bar and its raised Scan button, so a primary button is never covered (first open, after a banner, any length).
import { useState, type ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SvgXml } from 'react-native-svg';
import { magenQr } from './qr';
import { C } from './theme';

/** 10 pt lift + 66 pt bar + 30 pt raised Scan button + 10 pt gap. */
export const BAR_SPACE = 10 + 66 + 30 + 10;
export const ACTION_H = 54;
/** Amount fields: digits and one dot; a leading dot becomes "0." so ".2" reads as 0.2 NEAR. */
export const decimal = (t: string) => { const c = t.replace(/[^\d.]/g, '').replace(/^\./, '0.'); const i = c.indexOf('.'); return i < 0 ? c : c.slice(0, i + 1) + c.slice(i + 1).replace(/\./g, ''); };

export function Screen({ children, action, notice }: { children: ReactNode; action?: ReactNode; notice?: ReactNode; tall?: boolean }) {
  const insets = useSafeAreaInsets();
  const bottom = insets.bottom + BAR_SPACE;
  // The sticky area's real height (buttons + any status banner) pads the scroll so nothing hides under it.
  const [actH, setActH] = useState(ACTION_H + 24 + bottom);
  return <View style={{ flex: 1 }}>
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: (action ? actH : bottom) + 16, gap: 14 }} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive">
      {children}
    </ScrollView>
    {action ? <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }} onLayout={e => setActH(e.nativeEvent.layout.height)}>
      <LinearGradient pointerEvents="none" colors={['rgba(11,12,15,0)', C.bg]} style={{ height: 22 }} />
      <View style={{ backgroundColor: C.bg, paddingHorizontal: 16, paddingTop: 2, paddingBottom: bottom, gap: 10 }}>{notice}{action}</View>
    </View> : null}
  </View>;
}

/** Magen's lattice QR on a white tile. */
export function Qr({ value, size = 200 }: { value: string; size?: number }) {
  const svg = magenQr(value, size).svg;
  return <View style={{ alignSelf: 'center', backgroundColor: '#fff', borderRadius: 24, padding: 12 }} accessibilityLabel={`QR code for ${value}`}>
    <SvgXml xml={svg} width={size} height={size} />
  </View>;
}
