import * as Clipboard from 'expo-clipboard';
import { Bug, Check, Copy, Share2, Trash2 } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Card, EmptyState, TopBar, Txt } from '@/components/ui';
import { Brand, Font, Type } from '@/constants/theme';
import { clearLog, deviceInfo, formatReport, getLog, subscribeLog, type LogEntry } from '@/lib/log';
import { useApp } from '@/store/app-store';

const LEVEL_COLOR = { error: Brand.danger, warn: Brand.warning, info: '#7C7C93' };

export default function ErrorLog() {
  const { palette: p } = useApp();
  const insets = useSafeAreaInsets();
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const d = deviceInfo();

  useEffect(() => {
    const refresh = () => getLog().then((l) => setEntries([...l]));
    refresh();
    return subscribeLog(refresh);
  }, []);

  const share = async () => {
    const report = await formatReport();
    if (Platform.OS === 'web') {
      await Clipboard.setStringAsync(report);
      setCopied(true);
      return;
    }
    await Share.share({ message: report, title: 'BOOKLIT error log' });
  };
  const copy = async () => {
    await Clipboard.setStringAsync(await formatReport());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  const clear = () => {
    if (Platform.OS === 'web') return void clearLog();
    Alert.alert('Clear the error log?', 'This removes all saved entries on this device.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: () => void clearLog() },
    ]);
  };

  const errors = entries.filter((e) => e.level === 'error').length;

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <TopBar title="Error log" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 120 }}>
        <Card style={{ padding: 16, gap: 4 }}>
          <Txt weight="semibold">{errors} errors · {entries.length} entries</Txt>
          <Txt faint size={Type.tiny}>
            {d.platform} {d.osVersion} · {d.expoGo ? 'Expo Go' : `app ${d.app}`} · update {String(d.update).slice(0, 8)}
          </Txt>
          <Txt muted size={Type.tiny} style={{ marginTop: 6, lineHeight: 18 }}>
            If something fails, tap Share and send the log to the BOOKLIT team. It contains no passwords or file contents.
          </Txt>
        </Card>

        {!entries.length ? <EmptyState icon={Bug} title="No errors logged" text="Problems with uploads, Ask AI or any screen will appear here." /> : null}

        <View style={{ gap: 8, marginTop: 14 }}>
          {entries.map((e) => {
            const expanded = open === e.id;
            return (
              <Pressable key={e.id} onPress={() => setOpen(expanded ? null : e.id)} style={[styles.row, { backgroundColor: p.surface }]}>
                <View style={[styles.dot, { backgroundColor: LEVEL_COLOR[e.level] }]} />
                <View style={{ flex: 1, gap: 2 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                    <Txt weight="medium" size={Type.tiny} color={LEVEL_COLOR[e.level]}>{e.area.toUpperCase()}</Txt>
                    <Txt faint size={Type.tiny}>{new Date(e.at).toLocaleString()}</Txt>
                  </View>
                  <Txt size={Type.small} numberOfLines={expanded ? undefined : 2}>{e.message}</Txt>
                  {expanded && e.details ? (
                    <Txt selectable faint size={11} style={{ fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }) ?? Font.regular, marginTop: 6 }}>
                      {JSON.stringify(e.details, null, 2)}
                    </Txt>
                  ) : null}
                </View>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 12, backgroundColor: p.bg }]}>
        <Button label="Clear" icon={Trash2} variant="outline" style={{ flex: 1 }} onPress={clear} disabled={!entries.length} />
        <Button label={copied ? 'Copied' : 'Copy'} icon={copied ? Check : Copy} variant="soft" style={{ flex: 1 }} onPress={copy} />
        <Button label="Share" icon={Share2} variant="primary" style={{ flex: 1.2 }} onPress={share} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10, padding: 12, borderRadius: 16 },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 5 },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', gap: 8, paddingHorizontal: 20, paddingTop: 10 },
});
