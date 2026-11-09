import { router } from 'expo-router';
import { Crown, Lock } from 'lucide-react-native';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { Type } from '@/constants/theme';
import { IS_AR } from '@/i18n';
import { usePalette } from '@/store/app-store';
import { Button, Icon, Txt } from './ui';

export function LockedModal({ visible, onClose, subjectName }: { visible: boolean; onClose: () => void; subjectName?: string }) {
  const p = usePalette();
  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.sheet, { backgroundColor: p.surface }]}>
          <View style={[styles.icon, { backgroundColor: p.primarySoft }]}>
            <Icon as={Lock} size={24} color={p.primary} />
          </View>
          <Txt weight="semibold" size={Type.h2} style={{ marginTop: 14, textAlign: 'center' }}>
            {IS_AR ? `${subjectName ?? 'هذه المادة'} مقفلة` : `${subjectName ?? 'This subject'} is locked`}
          </Txt>
          <Txt muted style={{ textAlign: 'center', marginTop: 8, lineHeight: 22 }}>
            Subscribe to Pro or Premium to open every subject.
          </Txt>
          <View style={{ alignSelf: 'stretch', gap: 8, marginTop: 20 }}>
            <Button
              label="See plans"
              icon={Crown}
              variant="primary"
              onPress={() => {
                onClose();
                router.push({ pathname: '/settings/[key]', params: { key: 'account' } });
              }}
            />
            <Button label="Close" variant="outline" onPress={onClose} />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(15,15,30,0.4)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  sheet: { width: '100%', maxWidth: 360, borderRadius: 28, padding: 24, alignItems: 'center' },
  icon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
});
