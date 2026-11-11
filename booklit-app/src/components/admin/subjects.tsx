import { ArrowDown, ArrowUp, ImagePlus, ListOrdered, Plus, RotateCcw, Trash2, X } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Brand, Font, Type } from '@/constants/theme';
import { bookletsOf, builtinBooklet, getSubject, stageName, stages, subjects } from '@/data/content';
import type { Catalog, StageId, Subject } from '@/data/types';
import { t as tt } from '@/i18n';
import { pickImage } from '@/lib/editor';
import { uploadImage } from '@/lib/publish';
import { accessOf, useApp } from '@/store/app-store';
import { StoredImage } from '../stored-image';
import { Button, Card, Icon, SubjectThumb, Txt } from '../ui';
import { adm, confirm, Seg } from './common';

type Level = 'free' | 'pro' | 'premium';

/** Save the whole catalog (subjects, order, universities, AI rules) and use the server's copy. */
export async function saveCatalog(app: ReturnType<typeof useApp>, next: Catalog) {
  const d = await adm<{ catalog: Catalog }>('catalog.save', { catalog: next });
  app.set({ catalog: d.catalog });
  return d.catalog;
}

const slug = (s: string) =>
  `${s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 30) || 'subject'}-${Math.random().toString(36).slice(2, 6)}`;

/** Subjects: add, delete, order booklets and choose which plan opens each one. */
export function Subjects() {
  'use no memo'; // reads the shared content lists, which change when the catalog is saved
  const app = useApp();
  const p = app.palette;
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [adding, setAdding] = useState<StageId | null>(null);
  const [ordering, setOrdering] = useState<Subject | null>(null);
  const canAccess = app.can('pricing');
  const canContent = app.canUpload;
  const cat = app.catalog;

  const run = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key);
    setError('');
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const setLevel = (id: string, level: Level) =>
    run(id, async () => {
      const d = await adm<{ access: Record<string, Level> }>('subjects.save', { access: { ...app.subjectAccess, [id]: level } });
      app.set({ subjectAccess: d.access });
    });

  const removeSubject = async (s: Subject) => {
    if (!(await confirm('Delete this subject?', s.custom ? 'It is removed for every student.' : 'It is hidden for every student. You can restore it below.', 'Delete', true))) return;
    void run(s.id, () =>
      saveCatalog(app, s.custom ? { ...cat, subjects: cat.subjects.filter((x) => x.id !== s.id) } : { ...cat, hiddenSubjects: [...new Set([...cat.hiddenSubjects, s.id])] }),
    );
  };

  return (
    <View style={{ gap: 12 }}>
      <Card style={{ padding: 16, gap: 4 }}>
        <Txt weight="semibold">Subjects</Txt>
        <Txt muted size={Type.small} style={{ lineHeight: 20 }}>
          Add subjects, put their booklets in order and choose who opens each one. Free: every student. Pro: Pro and Premium. Premium: Premium only.
        </Txt>
      </Card>
      {error ? <Txt size={Type.small} color="#E5484D">{error}</Txt> : null}

      {stages.map((st) => {
        const list = subjects.filter((s) => s.stageId === st.id && s.id !== 'uploads');
        return (
          <View key={st.id} style={{ gap: 8 }}>
            <View style={styles.line}>
              <Txt weight="semibold" size={Type.small} muted style={{ flex: 1, marginTop: 6 }}>{st.name}</Txt>
              {canContent ? (
                <Pressable onPress={() => setAdding(adding === st.id ? null : st.id)} style={[styles.pill, { backgroundColor: p.primarySoft }]}>
                  <Icon as={Plus} size={14} color={p.primary} />
                  <Txt weight="semibold" size={Type.tiny} color={p.primary}>Add subject</Txt>
                </Pressable>
              ) : null}
            </View>
            {adding === st.id ? <AddSubject stageId={st.id} onDone={() => setAdding(null)} /> : null}
            {list.map((s) => {
              const level = accessOf(s.id, s.isFree, app.subjectAccess);
              return (
                <Card key={s.id} style={{ padding: 12, gap: 10 }}>
                  <View style={styles.line}>
                    <SubjectThumb subjectId={s.id} size={42} radius={12} />
                    <View style={{ flex: 1 }}>
                      <Txt weight="medium" numberOfLines={1}>{s.name}</Txt>
                      <Txt faint size={Type.tiny}>{IS_COUNT(bookletsOf(s.id).length)}</Txt>
                    </View>
                    {busy === s.id ? <ActivityIndicator size="small" color={p.primary} /> : null}
                    {canContent ? (
                      <>
                        <Pressable onPress={() => setOrdering(s)} hitSlop={6} style={styles.iconBtn} accessibilityLabel={tt('Booklet order')}>
                          <Icon as={ListOrdered} size={18} />
                        </Pressable>
                        <Pressable onPress={() => void removeSubject(s)} hitSlop={6} style={styles.iconBtn} accessibilityLabel={tt('Delete subject')}>
                          <Icon as={Trash2} size={17} color={Brand.danger} />
                        </Pressable>
                      </>
                    ) : null}
                  </View>
                  <View pointerEvents={canAccess && !busy ? 'auto' : 'none'} style={{ opacity: canAccess ? 1 : 0.6 }}>
                    <Seg<Level>
                      value={level}
                      onChange={(v) => v !== level && void setLevel(s.id, v)}
                      options={[
                        { key: 'free', label: tt('Free') },
                        { key: 'pro', label: 'Pro' },
                        { key: 'premium', label: 'Premium' },
                      ]}
                    />
                  </View>
                </Card>
              );
            })}
          </View>
        );
      })}

      {canContent && cat.hiddenSubjects.length ? (
        <View style={{ gap: 8, marginTop: 10 }}>
          <Txt weight="semibold">Deleted subjects</Txt>
          {cat.hiddenSubjects.map((id) => (
            <Restore key={id} title={id} busy={busy === id} onPress={() => run(id, () => saveCatalog(app, { ...cat, hiddenSubjects: cat.hiddenSubjects.filter((x) => x !== id) }))} />
          ))}
        </View>
      ) : null}

      {canContent && app.hiddenBooklets.length ? (
        <View style={{ gap: 8, marginTop: 10 }}>
          <Txt weight="semibold">Deleted booklets</Txt>
          {app.hiddenBooklets.map((id) => {
            const b = builtinBooklet(id);
            return (
              <Restore
                key={id}
                title={b?.title ?? id}
                sub={b ? getSubject(b.subjectId)?.name : ''}
                busy={busy === id}
                onPress={() =>
                  run(id, async () => {
                    const d = await adm<{ hidden: string[] }>('content.hide', { id, hidden: false });
                    app.set({ hiddenBooklets: d.hidden });
                  })
                }
              />
            );
          })}
        </View>
      ) : null}

      <OrderSheet subject={ordering} onClose={() => setOrdering(null)} />
    </View>
  );
}

const IS_COUNT = (n: number) => tt(`${n} booklets`);

function Restore({ title, sub, busy, onPress }: { title: string; sub?: string; busy: boolean; onPress: () => void }) {
  const { palette: p } = useApp();
  return (
    <Card style={[styles.line, { padding: 12 }]}>
      <View style={{ flex: 1 }}>
        <Txt weight="medium" numberOfLines={1}>{title}</Txt>
        {sub ? <Txt faint size={Type.tiny}>{sub}</Txt> : null}
      </View>
      <Pressable disabled={busy} onPress={onPress} style={[styles.pill, { backgroundColor: p.primarySoft }]}>
        {busy ? <ActivityIndicator size="small" color={p.primary} /> : <Icon as={RotateCcw} size={14} color={p.primary} />}
        <Txt weight="semibold" size={Type.small} color={p.primary}>Restore</Txt>
      </Pressable>
    </Card>
  );
}

function AddSubject({ stageId, onDone }: { stageId: StageId; onDone: () => void }) {
  const app = useApp();
  const p = app.palette;
  const [name, setName] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const save = async () => {
    setBusy(true);
    setError('');
    try {
      const id = slug(name);
      const url = image ? await uploadImage(image, `subject-${id}`) : undefined;
      const subject: Subject = { id, name: name.trim(), stageId, color: '#493BEA', icon: 'book', isFree: true, description: '', image: url };
      await saveCatalog(app, { ...app.catalog, subjects: [...app.catalog.subjects, subject] });
      onDone();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card style={{ padding: 14, gap: 12 }}>
      <Txt weight="semibold" size={Type.small}>{tt('New subject')} · {stageName(stageId)}</Txt>
      <View style={styles.line}>
        <Pressable onPress={async () => setImage((await pickImage('library', 'subject').catch(() => null)) ?? image)} style={[styles.pic, { backgroundColor: p.primarySoft }]} accessibilityLabel={tt('Add image')}>
          {image ? <SubjectPreview uri={image} /> : <Icon as={ImagePlus} size={20} color={p.primary} />}
        </Pressable>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder={tt('Subject name, e.g. Conservative Dentistry')}
          placeholderTextColor={p.textFaint}
          style={[styles.input, { flex: 1, borderColor: p.border, color: p.text, fontFamily: Font.regular }]}
          autoFocus
        />
      </View>
      <Txt faint size={Type.tiny}>The picture is optional. Without one, a simple icon is shown.</Txt>
      {error ? <Txt size={Type.small} color="#E5484D">{error}</Txt> : null}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Button label="Cancel" variant="outline" style={{ flex: 1 }} onPress={onDone} />
        <Button label={busy ? 'Saving…' : 'Add'} icon={Plus} variant="primary" style={{ flex: 1 }} disabled={busy || name.trim().length < 2} onPress={save} />
      </View>
    </Card>
  );
}

function SubjectPreview({ uri }: { uri: string }) {
  // Local picks on the web are stored as "idb:" keys; StoredImage resolves them.
  return <StoredImage uri={uri} style={{ width: 52, height: 52 }} contentFit="cover" />;
}

/** Put a subject's booklets in order with up/down arrows. Saved straight away for every student. */
function OrderSheet({ subject, onClose }: { subject: Subject | null; onClose: () => void }) {
  'use no memo'; // reads the shared content lists, which change when the catalog is saved
  const app = useApp();
  const p = app.palette;
  const [busy, setBusy] = useState(false);
  if (!subject) return null;
  const list = bookletsOf(subject.id);
  const move = async (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= list.length) return;
    const ids = list.map((b) => b.id);
    [ids[i], ids[j]] = [ids[j], ids[i]];
    setBusy(true);
    try {
      await saveCatalog(app, { ...app.catalog, order: { ...app.catalog.order, [subject.id]: ids } });
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.sheet, { backgroundColor: p.bg }]}>
          <View style={styles.line}>
            <View style={{ flex: 1 }}>
              <Txt weight="semibold" size={Type.h2}>{subject.name}</Txt>
              <Txt muted size={Type.tiny}>Booklet order · saved for every student</Txt>
            </View>
            {busy ? <ActivityIndicator size="small" color={p.primary} /> : null}
            <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close">
              <Icon as={X} size={20} />
            </Pressable>
          </View>
          <View style={{ gap: 8, marginTop: 14 }}>
            {list.length ? (
              list.map((b, i) => (
                <Card key={b.id} style={[styles.line, { padding: 12 }]}>
                  <View style={[styles.num, { backgroundColor: p.primarySoft }]}>
                    <Txt weight="semibold" size={Type.tiny} color={p.primary}>{i + 1}</Txt>
                  </View>
                  <Txt weight="medium" style={{ flex: 1 }} numberOfLines={2}>{b.title}</Txt>
                  <Pressable disabled={busy || i === 0} onPress={() => void move(i, -1)} style={[styles.iconBtn, i === 0 && { opacity: 0.3 }]} accessibilityLabel={tt('Move up')}>
                    <Icon as={ArrowUp} size={18} />
                  </Pressable>
                  <Pressable disabled={busy || i === list.length - 1} onPress={() => void move(i, 1)} style={[styles.iconBtn, i === list.length - 1 && { opacity: 0.3 }]} accessibilityLabel={tt('Move down')}>
                    <Icon as={ArrowDown} size={18} />
                  </Pressable>
                </Card>
              ))
            ) : (
              <Txt muted size={Type.small}>No booklets yet.</Txt>
            )}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  line: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999 },
  iconBtn: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  input: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 11, fontSize: 14.5 },
  pic: { width: 52, height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  num: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  backdrop: { flex: 1, backgroundColor: 'rgba(10,10,20,0.45)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 22, paddingBottom: 36, maxWidth: 640, width: '100%', alignSelf: 'center', maxHeight: '85%' },
});
