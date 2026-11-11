import { Check, ChevronDown, GraduationCap, X } from 'lucide-react-native';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Type } from '@/constants/theme';
import { getUniversity } from '@/data/content';
import { useApp } from '@/store/app-store';
import { Icon, Txt } from './ui';

/**
 * "Your university" pill: one tap opens the list, one tap switches. The library then shows that
 * university's subjects. Hidden until the admin adds universities.
 */
export function UniversityPicker({ compact }: { compact?: boolean }) {
  const app = useApp();
  const p = app.palette;
  const [open, setOpen] = useState(false);
  const list = app.catalog.universities;
  if (!list.length) return null;
  const current = getUniversity(app.universityId);

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.pill, { backgroundColor: current ? p.surface : p.primary, borderColor: p.border }, compact && { alignSelf: 'flex-start' }, pressed && { opacity: 0.8 }]}
        accessibilityLabel="Choose your university">
        <Icon as={GraduationCap} size={16} color={current ? p.primary : '#fff'} />
        <Txt weight="semibold" size={Type.small} color={current ? p.text : '#fff'} numberOfLines={1} style={{ flexShrink: 1 }}>
          {current ? current.name : 'Choose your university'}
        </Txt>
        <Icon as={ChevronDown} size={15} color={current ? p.textMuted : '#fff'} />
      </Pressable>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={[styles.sheet, { backgroundColor: p.bg }]}>
            <View style={styles.head}>
              <Txt weight="semibold" size={Type.h2} style={{ flex: 1 }}>Your university</Txt>
              <Pressable onPress={() => setOpen(false)} hitSlop={10} accessibilityLabel="Close">
                <Icon as={X} size={20} />
              </Pressable>
            </View>
            <Txt muted size={Type.small} style={{ marginBottom: 12 }}>You see the subjects of your university. Change it any time.</Txt>
            <ScrollView style={{ maxHeight: 420 }} contentContainerStyle={{ gap: 8 }}>
              {list.map((u) => {
                const on = u.id === app.universityId;
                return (
                  <Pressable
                    key={u.id}
                    onPress={() => {
                      app.chooseUniversity(u.id);
                      setOpen(false);
                    }}
                    style={({ pressed }) => [styles.row, { backgroundColor: on ? p.primarySoft : p.surface, borderColor: on ? p.primary : 'transparent' }, pressed && { opacity: 0.8 }]}>
                    <Icon as={GraduationCap} size={18} color={p.primary} />
                    <Txt weight={on ? 'semibold' : 'medium'} style={{ flex: 1 }}>{u.name}</Txt>
                    {on ? <Icon as={Check} size={18} color={p.primary} /> : null}
                  </Pressable>
                );
              })}
              <Pressable
                onPress={() => {
                  app.chooseUniversity(null);
                  setOpen(false);
                }}
                style={({ pressed }) => [styles.row, { backgroundColor: p.surface, borderColor: !app.universityId ? p.primary : 'transparent' }, pressed && { opacity: 0.8 }]}>
                <Txt muted style={{ flex: 1 }}>Show every subject</Txt>
                {!app.universityId ? <Icon as={Check} size={18} color={p.primary} /> : null}
              </Pressable>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  pill: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999, borderWidth: 1, maxWidth: '100%' },
  backdrop: { flex: 1, backgroundColor: 'rgba(10,10,20,0.45)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 22, paddingBottom: 36, maxWidth: 640, width: '100%', alignSelf: 'center' },
  head: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 15, borderRadius: 18, borderWidth: 1.5 },
});
