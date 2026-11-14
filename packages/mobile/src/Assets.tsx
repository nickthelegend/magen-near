// Home's W2 pieces: the chain avatar row, the striped share bars, and the live asset reader behind them.
// Amounts are real NEAR testnet reads (account balance + ft_balance_of). The bar fill is each asset's share of the
// wallet's value at 1Click's live token prices; if a price or an amount is missing the bar says so instead of guessing.
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Image, Pressable, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { ChevronsLeftRight, Plus } from 'lucide-react-native';
import { ftBalance } from '../../../sdk/swap.ts';
import { C, LOGO, T } from './theme';

/* ---------- live assets ---------- */
export type AssetId = 'near' | 'nbtc' | 'nzec' | 'usdt';
export type Asset = { id: AssetId; name: string; sub: string; logo: any; amount: bigint | null; decimals: number; symbol: string; price: number | null };
const TOKENS: { id: AssetId; token: string | null; name: string; sub: string; logo: string; decimals: number; price: [string, string] }[] = [
  { id: 'near', token: null, name: 'NEAR', sub: 'Native', logo: 'near', decimals: 24, price: ['wNEAR', 'near'] },
  { id: 'nbtc', token: 'nbtc.n-bridge.testnet', name: 'nBTC', sub: 'Bitcoin, bridged', logo: 'bitcoin', decimals: 8, price: ['BTC', 'btc'] },
  { id: 'nzec', token: 'nzcash.n-bridge.testnet', name: 'nZEC', sub: 'Zcash, bridged', logo: 'zcash', decimals: 8, price: ['ZEC', 'zec'] },
  { id: 'usdt', token: 'usdt.itachicara.testnet', name: 'USDT', sub: 'Ref testnet token', logo: 'usdt', decimals: 24, price: ['USDT', 'near'] },
];
let priceCache: { at: number; map: Record<string, number> } | null = null;
export async function prices(): Promise<Record<string, number>> {
  if (priceCache && Date.now() - priceCache.at < 120_000) return priceCache.map;
  const r = await fetch('https://1click.chaindefuser.com/v0/tokens');
  if (!r.ok) throw Error(`1Click token list HTTP ${r.status}`);
  const all: any[] = await r.json(); const map: Record<string, number> = {};
  for (const t of TOKENS) { const hit = all.find(x => x.symbol === t.price[0] && x.blockchain === t.price[1]); if (hit && typeof hit.price === 'number') map[t.id] = hit.price; }
  const eth = all.find(x => x.symbol === 'ETH' && x.blockchain === 'eth'); if (eth && typeof eth.price === 'number') map.eth = eth.price;
  priceCache = { at: Date.now(), map }; return map;
}

/** NEAR from the account view the wallet already polls; the three NEP-141 tokens and prices are read here every 30 s. */
export function useAssets(wallet: string, nearYocto: bigint | null | undefined) {
  const [tok, setTok] = useState<Record<string, bigint | null>>({});
  const [px, setPx] = useState<Record<string, number>>({});
  useEffect(() => {
    let live = true;
    const load = () => {
      TOKENS.filter(t => t.token).forEach(t => ftBalance(t.token!, wallet).then(v => live && setTok(m => ({ ...m, [t.id]: v }))).catch(() => live && setTok(m => ({ ...m, [t.id]: m[t.id] ?? null }))));
      prices().then(p => live && setPx(p)).catch(() => {});
    };
    load(); const t = setInterval(load, 30000);
    return () => { live = false; clearInterval(t); };
  }, [wallet]);
  return TOKENS.map<Asset>(t => ({ id: t.id, name: t.name, sub: t.sub, logo: LOGO[t.logo], decimals: t.decimals, symbol: t.name, price: px[t.id] ?? null,
    amount: t.id === 'near' ? (nearYocto ?? null) : (t.id in tok ? tok[t.id] : null) }));
}

/** Plain decimal string, floored to `places`, trailing zeros trimmed. */
export function units(v: bigint, decimals: number, places = 4) {
  const s = v.toString().padStart(decimals + 1, '0');
  const int = s.slice(0, s.length - decimals); const frac = s.slice(s.length - decimals).slice(0, places).replace(/0+$/, '');
  return BigInt(int).toLocaleString('en-US') + (frac ? '.' + frac : '');
}
const usd = (a: Asset) => (a.amount === null || a.price === null ? null : Number(a.amount) / 10 ** a.decimals * a.price);
/** Share of value per asset (0..1), or null when that asset's amount or price is unknown or the wallet holds nothing priced. */
export function shares(list: Asset[]) {
  const vals = list.map(usd); const total = vals.reduce<number>((s, v) => s + (v ?? 0), 0);
  return vals.map(v => (v === null || total <= 0 ? null : v / total));
}

/* ---------- avatar row ---------- */
export function ChainAvatars({ ids, onPlus }: { ids: string[]; onPlus: () => void }) {
  const D = 30;
  return <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }} accessibilityLabel={`Chains in this wallet: ${ids.join(', ')}`}>
    {ids.map((id, i) => <View key={id} style={{ marginLeft: i ? -7 : 0, width: D, height: D, borderRadius: D / 2, backgroundColor: '#fff', borderWidth: 2, borderColor: C.bg, alignItems: 'center', justifyContent: 'center', zIndex: 10 - i }}>
      <Image source={LOGO[id]} style={{ width: 15, height: 15 }} resizeMode="contain" />
    </View>)}
    <Pressable onPress={() => { Haptics.selectionAsync(); onPlus(); }} accessibilityRole="button" accessibilityLabel="Every chain" hitSlop={10}
      style={({ pressed }) => ({ marginLeft: 6, height: D, paddingHorizontal: 10, borderRadius: D / 2, borderWidth: 1, borderColor: C.line2, flexDirection: 'row', alignItems: 'center', gap: 4, transform: [{ scale: pressed ? 0.95 : 1 }] })}>
      <Plus color={C.accentText} size={14} strokeWidth={2.4} /><T style={{ color: C.text2, fontSize: 13, fontWeight: '600' }}>Every chain</T>
    </Pressable>
  </View>;
}

/* ---------- one portfolio bar ---------- */
const TINT: Record<string, string> = { near: '', nbtc: 'rgba(224,64,200,0.62)', nzec: 'rgba(224,64,200,0.40)', usdt: 'rgba(242,139,224,0.85)' };
/** A thin bar split by each asset's share of value (NEAR striped magenta, others solid tints) with a legend. Segments grow in once. */
export function PortfolioBar({ assets, shares: sh }: { assets: Asset[]; shares: (number | null)[] }) {
  const [w, setW] = useState(0); const grow = useRef(new Animated.Value(0)).current;
  useEffect(() => { if (!w) return; AccessibilityInfo.isReduceMotionEnabled().then(r => { if (r) grow.setValue(1); else Animated.timing(grow, { toValue: 1, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start(); }); }, [w]);
  const held = assets.map((a, i) => ({ a, s: sh[i] })).filter(x => x.a.amount !== null && x.a.amount > 0n);
  const priced = held.filter(x => x.s !== null && x.s > 0);
  const segs = priced.length ? priced.map(x => ({ id: x.a.id, name: x.a.name, s: Math.max(x.s!, 0.02) })) : held.filter(x => x.a.id === 'near').map(x => ({ id: 'near', name: 'NEAR', s: 1 }));
  const tot = segs.reduce((t, x) => t + x.s, 0) || 1; const H = 10;
  return <View style={{ width: '100%', gap: 10 }}>
    <View onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width)} style={{ height: H, borderRadius: H / 2, backgroundColor: C.s2, overflow: 'hidden', flexDirection: 'row' }}>
      {w > 0 && segs.map((x, i) => { const sw = w * x.s / tot - (i < segs.length - 1 ? 2 : 0);
        return <Animated.View key={x.id} style={{ width: grow.interpolate({ inputRange: [0, 1], outputRange: [0, Math.max(sw, 2)] }), height: H, marginRight: i < segs.length - 1 ? 2 : 0, overflow: 'hidden', backgroundColor: x.id === 'near' ? C.accent : TINT[x.id] ?? C.accentSoft }}>
          {x.id === 'near' && <Svg width={Math.max(sw, 2)} height={H}><Path d={stripes(Math.max(sw, 2), H)} fill={C.accent2} /></Svg>}
        </Animated.View>; })}
    </View>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', columnGap: 16, rowGap: 4 }}>
      {segs.length === 0 ? <T style={{ color: C.text2, fontSize: 13 }}>Nothing held yet</T> : segs.map(x => <View key={x.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: x.id === 'near' ? C.accent : TINT[x.id] }} />
        <T style={{ color: C.text2, fontSize: 13, fontWeight: '600' }}>{Math.round(x.s / tot * 100)}% {x.name}</T>
      </View>)}
    </View>
  </View>;
}

/* ---------- striped share bar ---------- */
const MIN = 0.18;
/** Diagonal bands (12 px wide every 24 px, leaning right) as one path: patterns with transforms render unevenly on iOS. */
const stripes = (w: number, h: number) => { let d = ''; for (let x = -h; x < w + h; x += 24) d += `M${x} ${h}L${x + 12} ${h}L${x + 12 + h * 0.8} 0L${x + h * 0.8} 0Z`; return d; };
/** A wide pill: magenta diagonal stripes filled to `pct` (at least 18 % so the knob fits), a round logo knob, the label near the fill's end. */
export function StripeBar({ pct, logo, label, onPress, a11y, height = 52 }: { pct: number | null; logo: any; label: string; onPress?: () => void; a11y?: string; height?: number }) {
  const [w, setW] = useState(0);
  const p = Math.min(1, Math.max(MIN, pct ?? 0)); const full = p >= 0.995;
  const fw = w * p; const knob = height - 10; const handle = 30;
  const textW = label.length * 8.6 + 6;
  const inside = full || fw - knob - 16 - handle - 10 >= textW;
  const body = <View onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width)} style={{ height, borderRadius: height / 2, backgroundColor: C.s2, overflow: 'hidden', borderWidth: 1, borderColor: C.line }}>
    {w > 0 && <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: fw, borderRadius: height / 2, overflow: 'hidden' }}>
      <Svg width={fw} height={height}>
        <Rect width={fw} height={height} fill={C.accent} />
        <Path d={stripes(fw, height)} fill={C.accent2} />
      </Svg>
      {!full && fw >= knob + handle + 22 && <View style={{ position: 'absolute', right: 5, top: (height - handle) / 2 - 1, width: handle, height: handle, borderRadius: handle / 2, backgroundColor: 'rgba(11,12,15,0.28)', alignItems: 'center', justifyContent: 'center' }}>
        <ChevronsLeftRight color="#fff" size={15} strokeWidth={2} />
      </View>}
    </View>}
    <View style={{ position: 'absolute', left: 4, top: 4, width: knob, height: knob, borderRadius: knob / 2, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } }}>
      <Image source={logo} style={{ width: knob * 0.52, height: knob * 0.52 }} resizeMode="contain" />
    </View>
    {w > 0 && <T numberOfLines={1} style={[{ position: 'absolute', top: 0, bottom: 0, textAlignVertical: 'center', lineHeight: height - 2, fontSize: 15.5, fontWeight: '700' },
      inside ? { right: full ? 20 : w - fw + handle + 12, color: '#fff' } : { left: fw + 12, color: C.text2 }]}>{label}</T>}
  </View>;
  return onPress ? <Pressable onPress={() => { Haptics.selectionAsync(); onPress(); }} accessibilityRole="button" accessibilityLabel={a11y ?? label}>{body}</Pressable> : <View accessibilityLabel={a11y ?? label}>{body}</View>;
}
