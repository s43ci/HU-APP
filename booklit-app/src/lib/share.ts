import * as Clipboard from 'expo-clipboard';
import { Alert, Platform, Share } from 'react-native';

import { t } from '@/i18n';

/** Public address of the app (the web app; it offers install on Android and iPhone). */
export const APP_URL = 'https://booklit.expo.app';

export const bookletUrl = (subjectId: string, bookletId: string) => `${APP_URL}/subject/${encodeURIComponent(subjectId)}?booklet=${encodeURIComponent(bookletId)}`;

/** Open the system share sheet; on browsers without one, copy the link instead. */
export async function shareLink(title: string, message: string, url: string) {
  try {
    if (Platform.OS === 'web') {
      const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void> };
      if (nav.share) return void (await nav.share({ title, text: message, url }));
      await Clipboard.setStringAsync(`${message}\n${url}`);
      window.alert(t('Link copied. Paste it anywhere to share.'));
      return;
    }
    await Share.share({ title, message: `${message}\n${url}`, url });
  } catch (e) {
    if ((e as Error).name === 'AbortError') return; // the user closed the share sheet
    await Clipboard.setStringAsync(`${message}\n${url}`).catch(() => {});
    if (Platform.OS !== 'web') Alert.alert(t('Link copied. Paste it anywhere to share.'));
  }
}

export const shareApp = () => shareLink('Booklit', t('Study your dental booklets with Booklit: ministry MCQs, Ask AI and more.'), APP_URL);
