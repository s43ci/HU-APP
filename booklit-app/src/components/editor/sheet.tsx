import type { ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Type } from '@/constants/theme';
import { usePalette } from '@/store/app-store';
import { Icon, Txt, type LucideIcon } from '../ui';

/** Simple bottom sheet with a title and a list of actions. */
export function Sheet({ visible, onClose, title, children }: { visible: boolean; onClose: () => void; title?: string; children: ReactNode }) {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.sheet, { backgroundColor: p.surface, paddingBottom: insets.bottom + 16 }]}>
          <View style={[styles.grabber, { backgroundColor: p.border }]} />
          {title ? (
            <Txt weight="semibold" size={Type.h2} style={{ marginBottom: 10 }}>
              {title}
            </Txt>
          ) : null}
          <ScrollView style={{ maxHeight: 460 }} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export function SheetItem({ icon, label, sub, onPress, danger }: { icon: LucideIcon; label: string; sub?: string; onPress: () => void; danger?: boolean }) {
  const p = usePalette();
  const color = danger ? '#E5484D' : p.primary;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.item, pressed && { backgroundColor: p.surfaceAlt }]}>
      <View style={[styles.itemIcon, { backgroundColor: danger ? p.dangerSoft : p.primarySoft }]}>
        <Icon as={icon} size={17} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Txt weight="medium" color={danger ? '#E5484D' : p.text}>{label}</Txt>
        {sub ? <Txt faint size={Type.tiny}>{sub}</Txt> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(15,15,30,0.35)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, paddingTop: 12 },
  grabber: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 14 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 6, borderRadius: 14 },
  itemIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
});
