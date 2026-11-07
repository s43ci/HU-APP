import { Linking, Modal, Pressable, StyleSheet, View } from 'react-native';

import { TELEGRAM_URL } from '@/constants/theme';
import { usePalette } from '@/store/app-store';
import { Button, IconBadge, Txt } from './ui';

export function LockedModal({ visible, onClose, subjectName }: { visible: boolean; onClose: () => void; subjectName?: string }) {
  const p = usePalette();
  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.sheet, { backgroundColor: p.surface }]}>
          <IconBadge name="lock-outline" size={60} />
          <Txt weight="bold" size={19} style={{ marginTop: 14, textAlign: 'center' }}>
            {subjectName ?? 'This subject'} is locked
          </Txt>
          <Txt muted style={{ textAlign: 'center', marginTop: 8, lineHeight: 22 }}>
            هذه المادة مقفلة ومتاحة للمشتركين فقط
          </Txt>
          <Txt muted size={13} style={{ textAlign: 'center', marginTop: 4, lineHeight: 19 }}>
            Contact us on Telegram to subscribe. Your access is activated after payment is confirmed.
          </Txt>
          <View style={{ alignSelf: 'stretch', gap: 10, marginTop: 20 }}>
            <Button label="تواصل عبر تيليجرام" icon="send" onPress={() => Linking.openURL(TELEGRAM_URL)} />
            <Button label="إغلاق" variant="ghost" onPress={onClose} />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(15,15,35,0.45)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  sheet: { width: '100%', maxWidth: 380, borderRadius: 24, padding: 24, alignItems: 'center' },
});
