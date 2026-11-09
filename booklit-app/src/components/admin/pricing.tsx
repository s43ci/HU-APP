import { Check } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Switch, TextInput, View } from 'react-native';

import { Font, Type } from '@/constants/theme';
import { t as tt } from '@/i18n';
import { finalPrice, formatPrice, type PlanConfig } from '@/lib/api';
import { useApp } from '@/store/app-store';
import { Button, Card, Txt } from '../ui';
import { adm } from './common';

export function Pricing() {
  const app = useApp();
  const p = app.palette;
  const [cfg, setCfg] = useState<PlanConfig | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const editable = app.can('pricing');

  useEffect(() => {
    adm<{ plans: PlanConfig }>('plans.get')
      .then((d) => setCfg(d.plans))
      .catch((e) => setMsg({ ok: false, text: (e as Error).message }));
  }, []);

  if (!cfg) return msg ? <Txt color="#E5484D">{msg.text}</Txt> : <ActivityIndicator color={p.primary} style={{ marginTop: 40 }} />;

  const setPlan = (k: 'pro' | 'premium', patch: Partial<PlanConfig['plans']['pro']>) => setCfg({ ...cfg, plans: { ...cfg.plans, [k]: { ...cfg.plans[k], ...patch } } });
  const numIn = (v: string) => Number(v.replace(/[^\d]/g, '')) || 0;

  const save = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const d = await adm<{ plans: PlanConfig }>('plans.save', { plans: cfg });
      setCfg(d.plans);
      setMsg({ ok: true, text: tt('Saved. Students see the new prices right away.') });
      void app.sync();
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ gap: 12 }}>
      {(['pro', 'premium'] as const).map((k) => {
        const pl = cfg.plans[k];
        const price = finalPrice(cfg, k);
        return (
          <Card key={k} style={{ padding: 16, gap: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Txt weight="semibold" size={Type.h2}>{k === 'pro' ? 'Pro' : 'Premium'}</Txt>
              <Txt weight="semibold" color={p.primary}>{price === 0 ? tt('Free') : formatPrice(price, cfg.currency)}</Txt>
            </View>
            <NumField label={`${tt('Price')} (${cfg.currency})`} value={pl.price} onChange={(v) => setPlan(k, { price: numIn(v) })} editable={editable && !pl.free} />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <NumField label={`${tt('Discount')} %`} value={pl.discountPct} onChange={(v) => setPlan(k, { discountPct: Math.min(100, numIn(v)) })} editable={editable && !pl.free} />
              </View>
              <View style={{ flex: 1 }}>
                <NumField label="Duration (days)" value={pl.days} onChange={(v) => setPlan(k, { days: Math.max(1, numIn(v)) })} editable={editable} />
              </View>
            </View>
            <View style={styles.switchRow}>
              <View style={{ flex: 1 }}>
                <Txt weight="medium">Make this plan free</Txt>
                <Txt faint size={Type.tiny}>Students activate it themselves, no approval needed.</Txt>
              </View>
              <Switch value={pl.free} onValueChange={(v) => setPlan(k, { free: v })} disabled={!editable} trackColor={{ true: p.primary }} />
            </View>
          </Card>
        );
      })}

      <Card style={{ padding: 16, gap: 8 }}>
        <Txt weight="semibold">How students pay</Txt>
        <Txt faint size={Type.tiny}>Shown under the plans: e.g. Zain Cash number, Qi Card, or where to pay in person.</Txt>
        <TextInput
          value={cfg.paymentNote}
          onChangeText={(v) => setCfg({ ...cfg, paymentNote: v })}
          editable={editable}
          multiline
          placeholder={tt('Payment instructions…')}
          placeholderTextColor={p.textFaint}
          style={[styles.area, { borderColor: p.border, color: p.text, fontFamily: Font.regular }]}
        />
        <NumLabel label="Currency" />
        <TextInput value={cfg.currency} onChangeText={(v) => setCfg({ ...cfg, currency: v.toUpperCase().slice(0, 8) })} editable={editable} autoCapitalize="characters" style={[styles.input, { borderColor: p.border, color: p.text, fontFamily: Font.regular }]} />
      </Card>

      {msg ? <Txt size={Type.small} color={msg.ok ? '#16A34A' : '#E5484D'}>{msg.text}</Txt> : null}
      {editable ? <Button label={busy ? 'Saving…' : 'Save prices'} icon={Check} variant="primary" disabled={busy} onPress={save} /> : <Txt faint size={Type.tiny}>You can view prices but not change them.</Txt>}
    </View>
  );
}

function NumLabel({ label }: { label: string }) {
  return <Txt weight="medium" size={Type.tiny} muted style={{ marginStart: 4, marginTop: 4 }}>{label}</Txt>;
}

function NumField({ label, value, onChange, editable }: { label: string; value: number; onChange: (v: string) => void; editable: boolean }) {
  const { palette: p } = useApp();
  return (
    <View style={{ gap: 6 }}>
      <NumLabel label={label} />
      <TextInput
        value={String(value)}
        onChangeText={onChange}
        editable={editable}
        keyboardType="number-pad"
        style={[styles.input, { borderColor: p.border, color: p.text, fontFamily: Font.regular, opacity: editable ? 1 : 0.5 }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  input: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 11, fontSize: 15 },
  area: { borderWidth: 1, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14.5, minHeight: 90, textAlignVertical: 'top' },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
});
