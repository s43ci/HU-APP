import { router } from 'expo-router';
import { BadgeDollarSign, Crown, Inbox, ShieldBan, Sparkles, UserPlus, Users, Wand2 } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { Type } from '@/constants/theme';
import { finalPrice, formatPrice, type PlanConfig } from '@/lib/api';
import { useApp } from '@/store/app-store';
import { Card, Icon, Txt, type LucideIcon } from '../ui';
import { adm } from './common';

type Stats = { students: number; newThisWeek: number; pro: number; premium: number; free: number; blocked: number; staff: number; revenue: number; approved: number };

export function Overview({ go }: { go: (tab: string) => void }) {
  const app = useApp();
  const p = app.palette;
  const [data, setData] = useState<{ stats: Stats | null; pending: number; plans: PlanConfig } | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    adm<{ stats: Stats | null; pending: number; plans: PlanConfig }>('overview')
      .then((d) => {
        setData(d);
        setError('');
      })
      .catch((e) => setError((e as Error).message));
  }, []);
  useEffect(() => {
    load();
    const iv = setInterval(load, 30_000);
    return () => clearInterval(iv);
  }, [load]);

  if (error) return <Txt color="#E5484D">{error}</Txt>;
  if (!data) return <ActivityIndicator color={p.primary} style={{ marginTop: 40 }} />;
  const s = data.stats;
  const cur = data.plans.currency;

  return (
    <View style={{ gap: 12 }}>
      {app.can('requests') ? (
        <Pressable onPress={() => go('requests')} style={({ pressed }) => [styles.pending, { backgroundColor: data.pending ? p.primary : p.surface }, pressed && { opacity: 0.9 }]}>
          <Icon as={Inbox} size={20} color={data.pending ? '#fff' : p.textMuted} />
          <View style={{ flex: 1 }}>
            <Txt weight="semibold" color={data.pending ? '#fff' : p.text}>Subscription requests</Txt>
            <Txt size={Type.tiny} color={data.pending ? 'rgba(255,255,255,0.8)' : p.textMuted}>{data.pending ? `${data.pending} waiting for your decision` : 'Nothing waiting'}</Txt>
          </View>
          {data.pending ? (
            <View style={styles.count}>
              <Txt weight="semibold" size={Type.small} color={p.primary}>{data.pending}</Txt>
            </View>
          ) : null}
        </Pressable>
      ) : null}

      {s ? (
        <View style={styles.grid}>
          <Stat icon={Users} label="Students" value={s.students} />
          <Stat icon={UserPlus} label="New this week" value={s.newThisWeek} />
          <Stat icon={Crown} label="Pro" value={s.pro} />
          <Stat icon={Sparkles} label="Premium" value={s.premium} />
          <Stat icon={BadgeDollarSign} label="Approved income" value={formatPrice(s.revenue, cur)} wide />
          <Stat icon={ShieldBan} label="Blocked" value={s.blocked} />
          <Stat icon={Users} label="Free accounts" value={s.free} />
        </View>
      ) : null}

      <Card style={{ padding: 16, gap: 8 }}>
        <Txt weight="semibold">Current prices</Txt>
        {(['pro', 'premium'] as const).map((k) => {
          const price = finalPrice(data.plans, k);
          return (
            <View key={k} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Txt muted>{k === 'pro' ? 'Pro' : 'Premium'}</Txt>
              <Txt weight="medium">{price === 0 ? 'Free' : formatPrice(price, cur)}{data.plans.plans[k].discountPct && !data.plans.plans[k].free ? `  (−${data.plans.plans[k].discountPct}%)` : ''}</Txt>
            </View>
          );
        })}
      </Card>

      {app.canUpload ? (
        <Pressable onPress={() => router.push('/studio')} style={({ pressed }) => [styles.pending, { backgroundColor: p.ink }, pressed && { opacity: 0.9 }]}>
          <Icon as={Wand2} size={20} color={p.onInk} />
          <View style={{ flex: 1 }}>
            <Txt weight="semibold" color={p.onInk}>BOOKLIT Studio</Txt>
            <Txt size={Type.tiny} color={p.onInk} style={{ opacity: 0.7 }}>Upload, design and publish booklets to every student</Txt>
          </View>
        </Pressable>
      ) : null}
    </View>
  );
}

function Stat({ icon, label, value, wide }: { icon: LucideIcon; label: string; value: number | string; wide?: boolean }) {
  const { palette: p } = useApp();
  return (
    <View style={[styles.stat, { backgroundColor: p.surface }, wide && { width: '100%' }]}>
      <Icon as={icon} size={17} color={p.primary} />
      <Txt weight="semibold" size={22} style={{ marginTop: 8, letterSpacing: -0.4 }}>{typeof value === 'number' ? value.toLocaleString('en-US') : value}</Txt>
      <Txt muted size={Type.tiny}>{label}</Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  pending: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: 22 },
  count: { minWidth: 30, height: 30, borderRadius: 15, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  stat: { width: '48.4%', flexGrow: 1, borderRadius: 20, padding: 14 },
});
