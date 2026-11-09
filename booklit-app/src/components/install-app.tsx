import { Download, Share, SquarePlus, X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, View } from 'react-native';

import { Type } from '@/constants/theme';
import { useApp } from '@/store/app-store';
import { Icon, Txt } from './ui';

type BipEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
type W = Window & { __bipEvent?: BipEvent | null };

const KEY = 'booklit.install.dismissed';

function standalone() {
  if (typeof window === 'undefined') return true;
  return window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}
const isIOS = () => typeof navigator !== 'undefined' && (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));

/**
 * "Install Booklit" card for the web app.
 * Android / desktop Chrome / Edge: one tap opens the system install prompt.
 * iPhone / iPad Safari: shows the two steps (Share → Add to Home Screen), since iOS has no install prompt.
 */
export function InstallApp({ compact }: { compact?: boolean }) {
  const { palette: p } = useApp();
  const [canPrompt, setCanPrompt] = useState(() => Platform.OS === 'web' && typeof window !== 'undefined' && !!(window as W).__bipEvent);
  const [hidden, setHidden] = useState(() => {
    if (Platform.OS !== 'web' || standalone()) return true;
    try {
      return !compact && localStorage.getItem(KEY) === '1';
    } catch {
      return false;
    }
  });
  const [guide, setGuide] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const on = () => setCanPrompt(true);
    const done = () => setHidden(true);
    window.addEventListener('booklit-installable', on);
    window.addEventListener('appinstalled', done);
    return () => {
      window.removeEventListener('booklit-installable', on);
      window.removeEventListener('appinstalled', done);
    };
  }, []);

  if (hidden || (!canPrompt && !isIOS())) return null;

  const install = async () => {
    const ev = (window as W).__bipEvent;
    if (ev) {
      await ev.prompt();
      const { outcome } = await ev.userChoice;
      (window as W).__bipEvent = null;
      if (outcome === 'accepted') setHidden(true);
      return;
    }
    setGuide(true);
  };
  const dismiss = () => {
    try {
      localStorage.setItem(KEY, '1');
    } catch {}
    setHidden(true);
  };

  return (
    <>
      <Pressable onPress={install} style={({ pressed }) => [styles.card, { backgroundColor: p.ink }, pressed && { opacity: 0.9 }]}>
        <View style={styles.icon}>
          <Icon as={Download} size={18} color={p.ink} />
        </View>
        <View style={{ flex: 1 }}>
          <Txt weight="semibold" color={p.onInk}>Install Booklit</Txt>
          <Txt size={Type.tiny} color={p.onInk} style={{ opacity: 0.7 }}>Full screen, faster, works offline. Free.</Txt>
        </View>
        <View style={[styles.btn, { backgroundColor: p.primary }]}>
          <Txt weight="semibold" size={Type.small} color="#fff">Install</Txt>
        </View>
        {!compact ? (
          <Pressable onPress={dismiss} hitSlop={10} accessibilityLabel="Close" style={{ marginStart: 2 }}>
            <Icon as={X} size={16} color={p.onInk} />
          </Pressable>
        ) : null}
      </Pressable>

      <Modal visible={guide} transparent animationType="fade" onRequestClose={() => setGuide(false)}>
        <Pressable style={styles.backdrop} onPress={() => setGuide(false)}>
          <View style={[styles.sheet, { backgroundColor: p.surface }]}>
            <Txt weight="semibold" size={Type.h2}>Add Booklit to your Home Screen</Txt>
            <Txt muted size={Type.small} style={{ marginTop: 4 }}>Open this page in Safari, then:</Txt>
            <Step n={1} icon={Share} text="Tap the Share button in Safari's toolbar" />
            <Step n={2} icon={SquarePlus} text="Choose “Add to Home Screen”, then Add" />
            <Pressable onPress={() => setGuide(false)} style={[styles.ok, { backgroundColor: p.ink }]}>
              <Txt weight="semibold" color={p.onInk}>Got it</Txt>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

function Step({ n, icon, text }: { n: number; icon: typeof Share; text: string }) {
  const { palette: p } = useApp();
  return (
    <View style={styles.step}>
      <View style={[styles.num, { backgroundColor: p.primarySoft }]}>
        <Txt weight="semibold" size={Type.tiny} color={p.primary}>{n}</Txt>
      </View>
      <Icon as={icon} size={18} color={p.primary} />
      <Txt style={{ flex: 1 }}>{text}</Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: 14, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, paddingStart: 14, borderRadius: 22, marginBottom: 16 },
  icon: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  btn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999 },
  backdrop: { flex: 1, backgroundColor: 'rgba(10,10,20,0.45)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 22, paddingBottom: 34, gap: 4 },
  step: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 14 },
  num: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  ok: { marginTop: 22, borderRadius: 999, paddingVertical: 14, alignItems: 'center' },
});
