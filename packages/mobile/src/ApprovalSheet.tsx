// Every transaction the SDK is about to broadcast stops here first: a dark bottom sheet with the decoded
// preview (network, signer, receiver, method, amount, gas, details) and the dual-signature badge. Nothing is sent
// unless the user taps Approve; Reject makes the SDK throw "Transaction rejected. Nothing was broadcast."
import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { Atom, KeyRound, ShieldCheck, ShieldAlert } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { setApprover, type Approval } from '../../../sdk/approval.ts';
import { C, MONO, T } from './theme';

export function ApprovalSheet() {
  const [p, setP] = useState<{ r: Approval; done: (ok: boolean) => void } | null>(null);
  useEffect(() => { setApprover(r => new Promise(done => setP({ r, done }))); return () => setApprover(); }, []);
  if (!p) return null;
  const answer = (v: boolean) => { Haptics.impactAsync(v ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light); setP(null); p.done(v); };
  const rows: [string, string][] = [['Network', p.r.network], ['Signer', p.r.signer], ['Receiver contract', p.r.receiver], ['Method', p.r.method], ['Amount / deposit', p.r.amount], ['Gas', p.r.gas]];
  return <Modal transparent visible animationType="slide" onRequestClose={() => answer(false)}>
    <View style={{ flex: 1, backgroundColor: 'rgba(5,6,8,0.72)', justifyContent: 'flex-end' }}>
      <View style={{ backgroundColor: C.s1, borderTopLeftRadius: 32, borderTopRightRadius: 32, borderWidth: 1, borderColor: C.line, maxHeight: '92%', paddingHorizontal: 20, paddingTop: 10, paddingBottom: 36 }}>
        <View style={{ alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: C.line2, marginBottom: 16 }} />
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <T style={{ color: C.text2, fontSize: 14, fontWeight: '500' }}>Approve transaction</T>
            <View style={{ paddingHorizontal: 10, height: 24, borderRadius: 12, backgroundColor: C.s2, justifyContent: 'center' }}><T style={{ fontSize: 12, color: C.text2, fontWeight: '600' }}>Test wallet</T></View>
          </View>
          <T display style={{ fontSize: 28, letterSpacing: -0.8, marginTop: 8, marginBottom: 14 }}>{p.r.title}</T>
          <View style={{ backgroundColor: C.s2, borderRadius: 22, paddingHorizontal: 16 }}>
            {rows.map(([k, v], i) => <View key={k} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 11, borderBottomWidth: i < rows.length - 1 ? 1 : 0, borderBottomColor: C.line }}>
              <T style={{ fontSize: 13, color: C.text3, width: 118 }}>{k}</T>
              <T style={{ fontSize: 13.5, color: C.text, flex: 1, textAlign: 'right', fontWeight: '500' }}>{v || '—'}</T>
            </View>)}
          </View>
          {p.r.details.length > 0 && <View style={{ marginTop: 12, gap: 6, paddingHorizontal: 4 }}>
            {p.r.details.map((d, i) => <T key={i} style={{ fontSize: 12.5, color: d.startsWith('Deliberate') ? C.redText : C.text2, lineHeight: 18, ...(/^(Wallet|Nonce|Expires):/.test(d) ? { fontFamily: MONO, fontSize: 11.5 } : null) }}>{d}</T>)}
          </View>}
          {p.r.dual ? <View style={{ backgroundColor: C.accentSoft, borderWidth: 1, borderColor: C.accentLine, padding: 14, borderRadius: 22, marginTop: 16, gap: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><ShieldCheck color={C.accent} size={18} /><T style={{ fontWeight: '600', fontSize: 15 }}>Signed twice · classical + quantum-safe</T></View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Sig icon={<KeyRound color={C.text} size={15} />} title="ed25519" sub="64 bytes" />
              <Sig pq icon={<Atom color={C.accent} size={15} />} title="ML-DSA-65" sub="3,309 bytes" />
            </View>
          </View> : <View style={{ backgroundColor: C.s2, padding: 14, borderRadius: 22, marginTop: 16, flexDirection: 'row', gap: 10 }}>
            <ShieldAlert color={C.accent} size={18} />
            <View style={{ flex: 1 }}><T style={{ fontWeight: '600' }}>Account authorization</T><T style={{ color: C.text2, fontSize: 13, marginTop: 4 }}>Review the access-key change before approving.</T></View>
          </View>}
        </ScrollView>
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 18 }}>
          <Pressable accessibilityRole="button" accessibilityLabel="Reject" onPress={() => answer(false)} style={({ pressed }) => ({ flex: 1, height: 54, borderRadius: 999, backgroundColor: C.s2, borderWidth: 1, borderColor: C.line2, alignItems: 'center', justifyContent: 'center', transform: [{ scale: pressed ? 0.97 : 1 }] })}>
            <T style={{ fontWeight: '600', fontSize: 16 }}>Reject</T></Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Approve" onPress={() => answer(true)} style={({ pressed }) => ({ flex: 1, height: 54, borderRadius: 999, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center', shadowColor: C.accent, shadowOpacity: 0.4, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, transform: [{ scale: pressed ? 0.97 : 1 }] })}>
            <T style={{ fontWeight: '600', fontSize: 16 }}>Approve</T></Pressable>
        </View>
      </View>
    </View>
  </Modal>;
}

const Sig = ({ icon, title, sub, pq }: any) => <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, padding: 6, paddingRight: 10, borderRadius: 999, backgroundColor: C.s1 }}>
  <View style={{ width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: pq ? C.accentSoft : 'rgba(255,255,255,0.08)' }}>{icon}</View>
  <View><T style={{ fontWeight: '600', fontSize: 13 }}>{title}</T><T style={{ color: C.text3, fontSize: 11.5 }}>{sub}</T></View>
</View>;
