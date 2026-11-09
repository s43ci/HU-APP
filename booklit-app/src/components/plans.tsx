import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Check, Clock, Crown, LayoutDashboard, Sparkles, Wallet, X } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, StyleSheet, View } from 'react-native';

import { Type } from '@/constants/theme';
import { IS_AR, t as tt } from '@/i18n';
import { api, finalPrice, formatPrice, type Account, type PlanConfig, type SubRequest } from '@/lib/api';
import { useApp } from '@/store/app-store';
import { Card, Icon, Txt } from './ui';

const FEATURES: Record<'pro' | 'premium', string[]> = {
  pro: ['Every booklet in every stage', 'Ministry & instructor MCQs, quizzes', 'Ask AI, translate, highlights & notes'],
  premium: ['Everything in Pro', 'Your own library: turn your PDFs into booklets', 'Edit the design of booklets'],
};

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString(IS_AR ? 'ar-IQ' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

/** Subscription page: current plan, the two plan cards, and the request / approval status. */
export function Plans() {
  const app = useApp();
  const p = app.palette;
  const acc = app.account;
  const plans = app.plans;
  const req = app.myRequest;
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');

  if (!acc) return null;
  if (app.isStaff) {
    return (
      <Card style={{ padding: 18, gap: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={[styles.badgeIcon, { backgroundColor: p.ink }]}>
            <Icon as={Crown} size={18} color={p.onInk} />
          </View>
          <View style={{ flex: 1 }}>
            <Txt weight="semibold" size={Type.h2}>{app.isAdmin ? 'Admin' : 'Moderator'}</Txt>
            <Txt muted size={Type.tiny}>Full access to every booklet.</Txt>
          </View>
        </View>
        <Pressable onPress={() => router.push('/admin')} style={[styles.cta, { backgroundColor: p.primary }]}>
          <Icon as={LayoutDashboard} size={17} color="#fff" />
          <Txt weight="semibold" color="#fff">Open admin dashboard</Txt>
        </Pressable>
      </Card>
    );
  }

  const request = async (plan: 'pro' | 'premium') => {
    setBusy(plan);
    setError('');
    try {
      const r = await api<{ account: Account; request: SubRequest | null; activated?: boolean }>('/api/me', { body: { plan } });
      app.setAccount(r.account);
      app.setMyRequest(r.request);
      if (r.activated) {
        const msg = tt('Your plan is active. Enjoy!');
        if (Platform.OS === 'web') window.alert(msg);
        else Alert.alert(msg);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const pending = req?.status === 'pending' ? req : null;
  const current = acc.plan;

  return (
    <View style={{ gap: 14 }}>
      {/* Current plan */}
      <Card style={{ padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={[styles.badgeIcon, { backgroundColor: current === 'free' ? p.surfaceAlt : p.primary }]}>
          <Icon as={current === 'free' ? Sparkles : Crown} size={18} color={current === 'free' ? p.textMuted : '#fff'} />
        </View>
        <View style={{ flex: 1 }}>
          <Txt faint size={Type.tiny}>Current plan</Txt>
          <Txt weight="semibold" size={Type.h2}>{current === 'free' ? 'Free' : current === 'pro' ? 'Pro' : 'Premium'}</Txt>
          {acc.planUntil && current !== 'free' ? (
            <Txt muted size={Type.tiny}>{IS_AR ? `فعّال حتى ${fmtDate(acc.planUntil)}` : `Active until ${fmtDate(acc.planUntil)}`}</Txt>
          ) : (
            <Txt muted size={Type.tiny}>Free subjects only</Txt>
          )}
        </View>
      </Card>

      {pending ? (
        <View style={[styles.notice, { backgroundColor: p.primarySoft }]}>
          <Icon as={Clock} size={18} color={p.primary} />
          <View style={{ flex: 1 }}>
            <Txt weight="semibold" size={Type.small} color={p.primary}>
              {IS_AR ? `طلب ${pending.plan === 'pro' ? 'Pro' : 'Premium'} قيد المراجعة` : `${pending.plan === 'pro' ? 'Pro' : 'Premium'} request under review`}
            </Txt>
            <Txt size={Type.tiny} muted style={{ lineHeight: 17, marginTop: 2 }}>Your plan is activated as soon as the BOOKLIT team confirms your payment.</Txt>
          </View>
        </View>
      ) : req?.status === 'rejected' && req.note !== 'Replaced by a new request' ? (
        <View style={[styles.notice, { backgroundColor: p.dangerSoft }]}>
          <Icon as={X} size={18} color="#E5484D" />
          <View style={{ flex: 1 }}>
            <Txt weight="semibold" size={Type.small} color="#B4363A">Your last request was not approved</Txt>
            {req.note ? <Txt size={Type.tiny} color="#B4363A" style={{ marginTop: 2 }}>{req.note}</Txt> : null}
          </View>
        </View>
      ) : null}

      {plans ? (
        <>
          <PlanCard kind="pro" plans={plans} current={current} pending={pending} busy={busy} onRequest={request} />
          <PlanCard kind="premium" plans={plans} current={current} pending={pending} busy={busy} onRequest={request} />
        </>
      ) : (
        <ActivityIndicator color={p.primary} style={{ marginVertical: 30 }} />
      )}

      {error ? <Txt size={Type.small} color="#E5484D">{error}</Txt> : null}

      {plans?.paymentNote ? (
        <Card style={{ padding: 16, gap: 6 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Icon as={Wallet} size={17} color={p.primary} />
            <Txt weight="semibold" size={Type.small}>How to pay</Txt>
          </View>
          <Txt muted size={Type.small} style={{ lineHeight: 21 }} selectable>{plans.paymentNote}</Txt>
        </Card>
      ) : null}
    </View>
  );
}

function PlanCard({
  kind,
  plans,
  current,
  pending,
  busy,
  onRequest,
}: {
  kind: 'pro' | 'premium';
  plans: PlanConfig;
  current: Account['plan'];
  pending: SubRequest | null;
  busy: string | null;
  onRequest: (k: 'pro' | 'premium') => void;
}) {
  const { palette: p } = useApp();
  const cfg = plans.plans[kind];
  const price = finalPrice(plans, kind);
  const dark = kind === 'premium';
  const fg = dark ? '#fff' : p.text;
  const sub = dark ? 'rgba(255,255,255,0.72)' : p.textMuted;
  const isCurrent = current === kind || (kind === 'pro' && current === 'premium');
  const isPending = pending?.plan === kind;
  const period = cfg.days >= 360 ? tt('/ year') : IS_AR ? `/ ${cfg.days} يوم` : `/ ${cfg.days} days`;

  const label = isCurrent ? (current === kind ? 'Your plan' : 'Included in Premium') : isPending ? 'Waiting for approval' : price === 0 ? 'Activate for free' : `Request ${kind === 'pro' ? 'Pro' : 'Premium'}`;
  const disabled = isCurrent || isPending || !!busy;

  const body = (
    <>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Txt weight="semibold" size={Type.h2} color={fg}>{kind === 'pro' ? 'Pro' : 'Premium'}</Txt>
        {dark ? (
          <View style={[styles.tag, { backgroundColor: 'rgba(255,255,255,0.16)' }]}>
            <Txt weight="medium" size={10.5} color="#fff">Most complete</Txt>
          </View>
        ) : null}
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
        {price === 0 ? (
          <Txt weight="semibold" size={30} color={fg} style={{ letterSpacing: -0.6 }}>Free</Txt>
        ) : (
          <>
            <Txt weight="semibold" size={30} color={fg} style={{ letterSpacing: -0.6 }}>{price.toLocaleString('en-US')}</Txt>
            <Txt weight="medium" size={Type.small} color={sub} style={{ marginBottom: 6 }}>{plans.currency === 'IQD' ? tt('IQD') : plans.currency} {period}</Txt>
          </>
        )}
        {(cfg.discountPct > 0 || cfg.free) && cfg.price > 0 ? (
          <Txt size={Type.small} color={sub} style={{ textDecorationLine: 'line-through', marginBottom: 6 }}>{formatPrice(cfg.price, plans.currency)}</Txt>
        ) : null}
        {cfg.discountPct > 0 && !cfg.free ? (
          <View style={[styles.tag, { backgroundColor: '#1DB954', marginBottom: 6 }]}>
            <Txt weight="semibold" size={10.5} color="#fff">−{cfg.discountPct}%</Txt>
          </View>
        ) : null}
      </View>

      <View style={{ gap: 8, marginTop: 14 }}>
        {FEATURES[kind].map((f) => (
          <View key={f} style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
            <View style={[styles.check, { backgroundColor: dark ? 'rgba(255,255,255,0.16)' : p.primarySoft }]}>
              <Icon as={Check} size={11} color={dark ? '#fff' : p.primary} stroke={2.4} />
            </View>
            <Txt size={Type.small} color={fg} style={{ flex: 1 }}>{f}</Txt>
          </View>
        ))}
      </View>

      <Pressable
        disabled={disabled}
        onPress={() => onRequest(kind)}
        style={({ pressed }) => [
          styles.cta,
          { marginTop: 18, backgroundColor: dark ? '#fff' : p.ink, opacity: isCurrent || isPending ? 0.55 : pressed ? 0.85 : 1 },
        ]}>
        {busy === kind ? <ActivityIndicator color={dark ? p.ink : p.onInk} size="small" /> : <Icon as={isCurrent ? Check : isPending ? Clock : Crown} size={16} color={dark ? '#17172B' : p.onInk} />}
        <Txt weight="semibold" color={dark ? '#17172B' : p.onInk}>{label}</Txt>
      </Pressable>
    </>
  );

  return dark ? (
    <LinearGradient colors={['#2B2A5E', '#493BEA', '#6A5CFF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.card}>
      {body}
    </LinearGradient>
  ) : (
    <View style={[styles.card, { backgroundColor: p.surface, borderWidth: 1, borderColor: p.border }]}>{body}</View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 26, padding: 20 },
  badgeIcon: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  tag: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999 },
  check: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  cta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 999, paddingVertical: 14 },
  notice: { flexDirection: 'row', gap: 10, padding: 14, borderRadius: 18, alignItems: 'flex-start' },
});
