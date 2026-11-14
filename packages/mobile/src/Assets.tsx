// Home's W2 pieces: the chain avatar row, the striped share bars, and the live asset reader behind them.
// Amounts are real NEAR testnet reads (account balance + ft_balance_of). The bar fill is each asset's share of the
// wallet's value at 1Click's live token prices; if a price or an amount is missing the bar says so instead of guessing.
import { useEffect, useState } from 'react';
import { Image, Pressable, View, type LayoutChangeEvent } from 'react-native';
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
async function prices(): Promise<Record<string, number>> {
  if (priceCache && Date.now() - priceCache.at < 120_000) return priceCache.map;
  const r = await fetch('https://1click.chaindefuser.com/v0/tokens');
  if (!r.ok) throw Error(`1Click token list HTTP ${r.status}`);
  const all: any[] = await r.json(); const map: Record<string, number> = {};
  for (const t of TOKENS) { const hit = all.find(x => x.symbol === t.price[0] && x.blockchain === t.price[1]); if (hit && typeof hit.price === 'number') map[t.id] = hit.price; }
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
  return <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }} accessibilityLabel={`Chains in this wallet: ${ids.join(', ')}`}>
    {ids.map((id, i) => <View key={id} style={{ marginLeft: i ? -10 : 0, width: 50, height: 50, borderRadius: 25, backgroundColor: '#fff', borderWidth: 3, borderColor: C.bg, alignItems: 'center', justifyContent: 'center', zIndex: 10 - i }}>
      <Image source={LOGO[id]} style={{ width: 24, height: 24 }} resizeMode="contain" />
    </View>)}
    <Pressable onPress={() => { Haptics.selectionAsync(); onPlus(); }} accessibilityRole="button" accessibilityLabel="Every chain" hitSlop={6}
      style={({ pressed }) => ({ marginLeft: -10, width: 50, height: 50, borderRadius: 25, backgroundColor: C.s2, borderWidth: 3, borderColor: C.bg, alignItems: 'center', justifyContent: 'center', transform: [{ scale: pressed ? 0.94 : 1 }] })}>
      <Plus color={C.accent} size={20} strokeWidth={2} />
    </Pressable>
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
