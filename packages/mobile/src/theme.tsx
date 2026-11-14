// Magen phone design system: near-black surfaces, one magenta accent (#E040C8), white text at 100/60/40 %,
// hairlines at 8 % white, fully round pills. Parkinsans for display numbers and titles, Reddit Sans for UI.
// Static weights are instanced from the variable fonts (assets/fonts, OFL) so iOS never falls back to system type.
import { StyleSheet, Text, View, type TextProps } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

export const C = {
  bg: '#0B0C0F', s1: '#15171C', s2: '#1D2027', s3: '#262A33',
  line: 'rgba(255,255,255,0.08)', line2: 'rgba(255,255,255,0.14)',
  text: '#FFFFFF', text2: 'rgba(255,255,255,0.72)', text3: 'rgba(255,255,255,0.56)',
  accent: '#E040C8', accent2: '#C930B1', accentSoft: 'rgba(224,64,200,0.14)', accentLine: 'rgba(224,64,200,0.32)', accentText: '#F28BE0',
  red: '#FF5A6A', redSoft: 'rgba(255,90,106,0.12)', redText: '#FFB3BA',
};

export const FONT = {
  display: 'Parkinsans-SemiBold',
  r: 'RedditSans-Regular', m: 'RedditSans-Medium', sb: 'RedditSans-SemiBold', b: 'RedditSans-Bold',
};
export const fontAssets = {
  [FONT.display]: require('../assets/fonts/Parkinsans-SemiBold.ttf'),
  [FONT.r]: require('../assets/fonts/RedditSans-Regular.ttf'),
  [FONT.m]: require('../assets/fonts/RedditSans-Medium.ttf'),
  [FONT.sb]: require('../assets/fonts/RedditSans-SemiBold.ttf'),
  [FONT.b]: require('../assets/fonts/RedditSans-Bold.ttf'),
};
export const MONO = 'Menlo';

/** Text in the Magen type system: fontWeight picks the matching static Reddit Sans face; `display` switches to Parkinsans. */
export function T({ style, display, ...p }: TextProps & { display?: boolean; children?: any }) {
  const f: any = StyleSheet.flatten([{ color: C.text, fontSize: 15 }, style]) ?? {};
  const { fontWeight, ...rest } = f;
  const w = Number(fontWeight ?? 400) || 400;
  const fam = rest.fontFamily ?? (display ? FONT.display : w >= 700 ? FONT.b : w >= 600 ? FONT.sb : w >= 500 ? FONT.m : FONT.r);
  return <Text {...p} style={[rest, { fontFamily: fam }]} />;
}

/** The soft accent glow at the top of every dark screen (accent at about 12 % alpha). */
export function TopGlow({ height = 420 }: { height?: number }) {
  return <View pointerEvents="none" style={[StyleSheet.absoluteFill, { height }]}>
    <Svg width="100%" height="100%">
      <Defs><RadialGradient id="g" cx="50%" cy="0%" rx="75%" ry="100%" fx="50%" fy="0%">
        <Stop offset="0" stopColor={C.accent} stopOpacity={0.12} />
        <Stop offset="0.55" stopColor={C.accent} stopOpacity={0.04} />
        <Stop offset="1" stopColor={C.accent} stopOpacity={0} />
      </RadialGradient></Defs>
      <Rect width="100%" height="100%" fill="url(#g)" />
    </Svg>
  </View>;
}

/** Chain and token logos (web3icons, MIT), rendered from the web app's SVGs. NEAR is drawn in its mono ink mark. */
export const LOGO: Record<string, any> = {
  near: require('../assets/chains/near.png'), bitcoin: require('../assets/chains/bitcoin.png'), zcash: require('../assets/chains/zcash.png'),
  ethereum: require('../assets/chains/ethereum.png'), solana: require('../assets/chains/solana.png'), usdt: require('../assets/chains/usdt.png'),
  cosmos: require('../assets/chains/cosmos.png'),
};
