import { CircleAlert, CircleCheck, ExternalLink, OctagonAlert } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Brand, Font, Type } from '@/constants/theme';
import { IS_AR, t as tt } from '@/i18n';
import { useApp } from '@/store/app-store';
import { Button, Card, Icon, Txt } from '../ui';
import { adm } from './common';

type Meter = { key: string; label: string; used: number; limit: number; unit: string; pct: number; total?: number };
type Limits = { aiBudgetUsd: number; hostingRequests: number; storageMb: number; accounts: number; androidMau: number };
type Report = {
  needsFold?: boolean;
  meters: Meter[];
  limits: Limits;
  ai: { calls: number; cost: number; inTok: number; outTok: number };
  aiByKind: Record<string, { calls: number; cost: number }>;
  platforms: { web: number; android: number; ios: number };
  daily: { day: string; requests: number; ai: number; aiCalls: number }[];
};

const LINKS = [
  { label: 'Expo usage (hosting & app updates)', url: 'https://expo.dev/accounts/sigha2026s-team/settings/usage' },
  { label: 'Supabase usage (accounts & storage)', url: 'https://supabase.com/dashboard/project/nacebnczhymlgixhqlif' },
  { label: 'Google AI Studio usage & billing', url: 'https://aistudio.google.com/usage' },
];

const KIND_LABEL: Record<string, string> = { ask: 'Ask AI', edit: 'Translate & editor', mcq: 'Question writing', import: 'File conversion', bank: 'Question banks' };

const fmt = (n: number, unit: string) => (unit === 'USD' ? `$${n < 1 && n > 0 ? n.toFixed(4) : n.toFixed(2)}` : `${Math.round(n).toLocaleString('en-US')}`);

/** Usage against plan limits, warnings before a limit is reached, and the monthly AI budget. */
export function Usage() {
  const app = useApp();
  const p = app.palette;
  const [r, setR] = useState<Report | null>(null);
  const [error, setError] = useState('');

  const [tick, setTick] = useState(0);
  const load = useCallback(() => setTick((n) => n + 1), []);
  useEffect(() => {
    let alive = true;
    // Usage is stored as many tiny records; when there are a lot, tidy them into the monthly summary first.
    const run = async (i: number): Promise<void> => {
      const d = await adm<Report>('usage');
      if (!alive) return;
      setR(d);
      setError('');
      if (d.needsFold && i < 10) {
        await adm('usage.fold');
        return run(i + 1);
      }
    };
    run(0).catch((e) => alive && setError((e as Error).message));
    return () => {
      alive = false;
    };
  }, [tick]);

  if (error) return <Txt color="#E5484D">{error}</Txt>;
  if (!r) return <ActivityIndicator color={p.primary} style={{ marginTop: 40 }} />;

  const alerts = r.meters.filter((m) => m.pct >= 0.8);
  const counting = !!r.needsFold;

  return (
    <View style={{ gap: 12 }}>
      {alerts.length ? (
        alerts.map((m) => <AlertCard key={m.key} m={m} />)
      ) : (
        <View style={[styles.banner, { backgroundColor: Brand.success + '16' }]}>
          <Icon as={CircleCheck} size={18} color={Brand.success} />
          <Txt weight="medium" size={Type.small} style={{ flex: 1 }}>Everything is within its limits this month.</Txt>
        </View>
      )}

      <Card style={{ padding: 16, gap: 16 }}>
        <View style={styles.line}>
          <Txt weight="semibold" style={{ flex: 1 }}>This month</Txt>
          {counting ? <ActivityIndicator size="small" color={p.primary} /> : null}
        </View>
        {r.meters.map((m) => (
          <MeterRow key={m.key} m={m} />
        ))}
      </Card>

      <DailyChart daily={r.daily} />

      <Card style={{ padding: 16, gap: 8 }}>
        <Txt weight="semibold">AI by feature</Txt>
        {Object.entries(r.aiByKind).length ? (
          Object.entries(r.aiByKind)
            .sort(([, a], [, b]) => b.cost - a.cost)
            .map(([k, v]) => (
              <View key={k} style={styles.line}>
                <Txt muted size={Type.small} style={{ flex: 1 }}>{tt(KIND_LABEL[k] ?? k)}</Txt>
                <Txt size={Type.small}>{v.calls.toLocaleString('en-US')} {tt('calls')}</Txt>
                <Txt weight="medium" size={Type.small} style={{ width: 72, textAlign: 'right' }}>{fmt(v.cost, 'USD')}</Txt>
              </View>
            ))
        ) : (
          <Txt faint size={Type.small}>No AI use yet this month.</Txt>
        )}
        <Txt faint size={Type.tiny} style={{ marginTop: 4 }}>
          {IS_AR
            ? `${(r.ai.inTok / 1e6).toFixed(2)} مليون رمز إدخال · ${(r.ai.outTok / 1e6).toFixed(2)} مليون رمز إخراج`
            : `${(r.ai.inTok / 1e6).toFixed(2)}M input tokens · ${(r.ai.outTok / 1e6).toFixed(2)}M output tokens`}
        </Txt>
      </Card>

      <Card style={{ padding: 16, gap: 8 }}>
        <Txt weight="semibold">Active users this month</Txt>
        <View style={styles.line}><Txt muted size={Type.small} style={{ flex: 1 }}>Web app</Txt><Txt weight="medium" size={Type.small}>{r.platforms.web}</Txt></View>
        <View style={styles.line}><Txt muted size={Type.small} style={{ flex: 1 }}>Android app</Txt><Txt weight="medium" size={Type.small}>{r.platforms.android}</Txt></View>
      </Card>

      {app.isAdmin ? <LimitsForm limits={r.limits} onSaved={load} /> : null}

      <Card style={{ padding: 16, gap: 6 }}>
        <Txt weight="semibold">Exact numbers from each service</Txt>
        <Txt faint size={Type.tiny} style={{ lineHeight: 17 }}>
          The numbers above are measured by Booklit itself. Hosting also counts the app&apos;s own files, and the services bill from their own meters, so check them here before a big month.
        </Txt>
        {LINKS.map((l) => (
          <Pressable key={l.url} onPress={() => Linking.openURL(l.url)} style={({ pressed }) => [styles.link, { borderColor: p.border }, pressed && { opacity: 0.7 }]}>
            <Txt size={Type.small} style={{ flex: 1 }}>{l.label}</Txt>
            <Icon as={ExternalLink} size={15} color={p.textMuted} />
          </Pressable>
        ))}
      </Card>
    </View>
  );
}

function status(pct: number) {
  return pct >= 1 ? { color: Brand.danger, label: 'Limit reached', icon: OctagonAlert } : pct >= 0.8 ? { color: Brand.warning, label: 'Close to the limit', icon: CircleAlert } : { color: Brand.success, label: 'OK', icon: CircleCheck };
}

function AlertCard({ m }: { m: Meter }) {
  const s = status(m.pct);
  const what =
    m.key === 'ai'
      ? m.pct >= 1
        ? 'AI is paused for students until next month. Raise the budget below to turn it back on.'
        : 'When the budget is used up, AI pauses for students (you and moderators keep it).'
      : 'Upgrade this service’s plan or raise the limit below, so nothing stops working.';
  return (
    <View style={[styles.banner, { backgroundColor: s.color + '16', alignItems: 'flex-start' }]}>
      <Icon as={s.icon} size={18} color={s.color} />
      <View style={{ flex: 1, gap: 2 }}>
        <Txt weight="semibold" size={Type.small}>
          {tt(s.label)} · {tt(m.label)} ({Math.round(m.pct * 100)}%)
        </Txt>
        <Txt muted size={Type.tiny} style={{ lineHeight: 17 }}>{what}</Txt>
      </View>
    </View>
  );
}

function MeterRow({ m }: { m: Meter }) {
  const { palette: p } = useApp();
  const s = status(m.pct);
  return (
    <View style={{ gap: 6 }}>
      <View style={styles.line}>
        <Txt weight="medium" size={Type.small} style={{ flex: 1 }}>{m.label}</Txt>
        <Icon as={s.icon} size={14} color={s.color} />
        <Txt size={Type.tiny} muted>{tt(s.label)}</Txt>
      </View>
      <View style={[styles.track, { backgroundColor: p.surfaceAlt }]}>
        <View style={[styles.fill, { width: `${Math.min(100, Math.max(m.pct * 100, m.used ? 1.5 : 0))}%`, backgroundColor: m.pct >= 0.8 ? s.color : p.primary }]} />
      </View>
      <Txt faint size={Type.tiny}>
        {fmt(m.used, m.unit)} / {fmt(m.limit, m.unit)} {m.unit === 'USD' ? '' : tt(m.unit)} · {Math.round(m.pct * 100)}%
      </Txt>
    </View>
  );
}

/** Daily AI cost, one thin bar per day; tap a bar to read its value. */
function DailyChart({ daily }: { daily: Report['daily'] }) {
  const { palette: p } = useApp();
  const [picked, setPicked] = useState<number | null>(null);
  const max = Math.max(0.0001, ...daily.map((d) => d.ai));
  const H = 96;
  const sel = picked !== null ? daily[picked] : daily[daily.length - 1];
  return (
    <Card style={{ padding: 16, gap: 10 }}>
      <Txt weight="semibold">AI cost per day</Txt>
      {sel ? (
        <Txt muted size={Type.tiny}>
          {sel.day} · ${sel.ai.toFixed(3)} · {sel.aiCalls} {tt('calls')} · {sel.requests.toLocaleString('en-US')} {tt('requests')}
        </Txt>
      ) : null}
      <View style={[styles.chart, { height: H, borderBottomColor: p.border }]}>
        {daily.map((d, i) => (
          <Pressable key={d.day} onPress={() => setPicked(i)} style={styles.barHit} accessibilityLabel={`${d.day}: $${d.ai.toFixed(3)}`}>
            <View style={{ height: Math.max(2, (d.ai / max) * (H - 4)), borderTopLeftRadius: 4, borderTopRightRadius: 4, backgroundColor: picked === i ? p.ink : p.primary, opacity: picked === null || picked === i ? 1 : 0.55 }} />
          </Pressable>
        ))}
      </View>
      <View style={styles.line}>
        <Txt faint size={10.5} style={{ flex: 1 }}>{daily[0]?.day.slice(5) ?? ''}</Txt>
        {daily.length > 1 ? <Txt faint size={10.5}>{daily[daily.length - 1]?.day.slice(5)}</Txt> : null}
      </View>
    </Card>
  );
}

function LimitsForm({ limits, onSaved }: { limits: Limits; onSaved: () => void }) {
  const { palette: p } = useApp();
  const [v, setV] = useState<Limits>(limits);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const field = (k: keyof Limits, label: string) => (
    <View style={{ flex: 1, minWidth: 140, gap: 6 }}>
      <Txt weight="medium" size={Type.tiny} muted style={{ marginStart: 4 }}>{label}</Txt>
      <TextInput
        value={String(v[k])}
        onChangeText={(x) => setV({ ...v, [k]: Number(x.replace(/[^\d.]/g, '')) || 0 })}
        keyboardType="decimal-pad"
        style={[styles.input, { borderColor: p.border, color: p.text, fontFamily: Font.regular }]}
      />
    </View>
  );
  return (
    <Card style={{ padding: 16, gap: 12 }}>
      <Txt weight="semibold">Limits & AI budget</Txt>
      <Txt faint size={Type.tiny} style={{ lineHeight: 17 }}>Set these to your current plans. You get a warning at 80%. When the AI budget is used up, AI pauses for students until next month.</Txt>
      <View style={styles.grid}>
        {field('aiBudgetUsd', tt('Monthly AI budget (USD)'))}
        {field('hostingRequests', tt('Hosting requests / month'))}
        {field('storageMb', tt('Storage (MB)'))}
        {field('accounts', tt('Active accounts / month'))}
        {field('androidMau', tt('Android users / month'))}
      </View>
      {msg ? <Txt size={Type.small} color={Brand.success}>{msg}</Txt> : null}
      <Button
        label={busy ? 'Saving…' : 'Save limits'}
        variant="primary"
        disabled={busy}
        onPress={async () => {
          setBusy(true);
          setMsg('');
          try {
            await adm('limits.save', { limits: v });
            setMsg(tt('Saved.'));
            onSaved();
          } catch (e) {
            setMsg((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  banner: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 18 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  track: { height: 8, borderRadius: 4, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4 },
  chart: { flexDirection: 'row', alignItems: 'flex-end', gap: 2, borderBottomWidth: StyleSheet.hairlineWidth },
  barHit: { flex: 1, maxWidth: 18, height: '100%', justifyContent: 'flex-end' },
  link: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 11, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1, marginTop: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  input: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 11, fontSize: 15 },
});
