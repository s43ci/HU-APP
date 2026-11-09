import { CloudOff, CloudUpload, Globe } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { Brand, Type } from '@/constants/theme';
import { IS_AR } from '@/i18n';
import type { ImportedBooklet } from '@/data/types';
import { logError } from '@/lib/log';
import { publishBooklet, unpublishBooklet } from '@/lib/publish';
import { useApp } from '@/store/app-store';
import { confirm } from './admin/common';
import { Icon, Txt } from './ui';

export type PublishStatus = 'draft' | 'published' | 'changed';

export function usePublishStatus(b: ImportedBooklet): PublishStatus {
  const app = useApp();
  const live = app.published.booklets.some((x) => x.id === b.id) || b.id in app.publishedMeta;
  if (!live) return 'draft';
  const at = app.publishedMeta[b.id];
  return at === undefined || at === (b.updatedAt ?? 0) || !app.importedBooklets.some((x) => x.id === b.id) ? 'published' : 'changed';
}

export function StatusTag({ status }: { status: PublishStatus }) {
  const { palette: p } = useApp();
  const c = status === 'published' ? Brand.success : status === 'changed' ? Brand.warning : p.textMuted;
  return (
    <View style={[styles.tag, { backgroundColor: c + '1F' }]}>
      <Txt weight="semibold" size={10.5} color={c}>{status === 'published' ? 'Published' : status === 'changed' ? 'Changes not published' : 'Draft'}</Txt>
    </View>
  );
}

/** Publish / update / unpublish a Studio booklet for every student. */
export function PublishCard({ booklet }: { booklet: ImportedBooklet }) {
  const app = useApp();
  const p = app.palette;
  const status = usePublishStatus(booklet);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');

  if (!app.canUpload) return null;

  const publish = async () => {
    setError('');
    setBusy(IS_AR ? 'جارٍ النشر…' : 'Publishing…');
    try {
      const out = await publishBooklet(booklet, [], (d, t) => t && setBusy(IS_AR ? `رفع الصور ${d}/${t}…` : `Uploading images ${d}/${t}…`));
      app.markPublished(out);
      void app.sync();
    } catch (e) {
      logError('publish', e, { booklet: booklet.id });
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const unpublish = async () => {
    if (!(await confirm('Unpublish this booklet?', 'Students will no longer see it. Your copy stays in Studio.', 'Unpublish', true))) return;
    setBusy('…');
    try {
      await unpublishBooklet(booklet.id);
      const meta = { ...app.publishedMeta };
      delete meta[booklet.id];
      app.set({ publishedMeta: meta, published: { ...app.published, booklets: app.published.booklets.filter((x) => x.id !== booklet.id) } });
      void app.sync();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <View style={[styles.card, { backgroundColor: status === 'published' ? p.surface : p.ink }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={[styles.icon, { backgroundColor: status === 'published' ? Brand.success + '1F' : 'rgba(255,255,255,0.14)' }]}>
          <Icon as={status === 'published' ? Globe : CloudUpload} size={19} color={status === 'published' ? Brand.success : '#fff'} />
        </View>
        <View style={{ flex: 1 }}>
          <Txt weight="semibold" color={status === 'published' ? p.text : '#fff'}>
            {status === 'published' ? 'Live for every student' : status === 'changed' ? 'You have unpublished changes' : 'Not published yet'}
          </Txt>
          <Txt size={Type.tiny} color={status === 'published' ? p.textMuted : 'rgba(255,255,255,0.7)'}>
            {status === 'published' ? 'Students get every update within a minute.' : 'Publish so every student sees it within a minute.'}
          </Txt>
        </View>
      </View>
      {error ? <Txt size={Type.small} color="#FF8A8D" style={{ marginTop: 8 }}>{error}</Txt> : null}
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
        {status !== 'published' ? (
          <Pressable disabled={!!busy} onPress={publish} style={({ pressed }) => [styles.btn, { backgroundColor: p.primary, flex: 1 }, pressed && { opacity: 0.85 }]}>
            {busy ? <ActivityIndicator size="small" color="#fff" /> : <Icon as={CloudUpload} size={16} color="#fff" />}
            <Txt weight="semibold" size={Type.small} color="#fff">{busy ?? (status === 'changed' ? 'Update for students' : 'Publish to all students')}</Txt>
          </Pressable>
        ) : null}
        {status !== 'draft' ? (
          <Pressable disabled={!!busy} onPress={unpublish} style={({ pressed }) => [styles.btn, { borderWidth: 1, borderColor: status === 'published' ? p.border : 'rgba(255,255,255,0.3)' }, status === 'published' && { flex: 1 }, pressed && { opacity: 0.85 }]}>
            {busy && status === 'published' ? <ActivityIndicator size="small" color={p.text} /> : <Icon as={CloudOff} size={16} color={status === 'published' ? p.text : '#fff'} />}
            <Txt weight="semibold" size={Type.small} color={status === 'published' ? p.text : '#fff'}>Unpublish</Txt>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 22, padding: 16, marginBottom: 16 },
  icon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 999 },
  tag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, alignSelf: 'flex-start' },
});
