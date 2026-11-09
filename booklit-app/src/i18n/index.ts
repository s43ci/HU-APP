/**
 * Language & direction.
 * The language is fixed for the whole run of the app (switching it restarts the app),
 * so `t()` is a plain function and layouts are flipped once at start-up.
 * - iOS/Android: Arabic is remembered by React Native's I18nManager (RTL survives restarts).
 * - Web: remembered in localStorage and applied to <html dir lang>.
 */
import * as Updates from 'expo-updates';
import { DevSettings, I18nManager, Platform } from 'react-native';

import { AR, AR_PATTERNS } from './ar';

export type Lang = 'en' | 'ar';
const WEB_KEY = 'booklit.lang';

function detect(): Lang {
  if (Platform.OS === 'web') {
    try {
      return globalThis.localStorage?.getItem(WEB_KEY) === 'ar' ? 'ar' : 'en';
    } catch {
      return 'en';
    }
  }
  return I18nManager.isRTL ? 'ar' : 'en';
}

export const LANG: Lang = detect();
export const IS_AR = LANG === 'ar';

if (Platform.OS === 'web' && typeof document !== 'undefined') {
  document.documentElement.dir = IS_AR ? 'rtl' : 'ltr';
  document.documentElement.lang = IS_AR ? 'ar' : 'en';
}

/** Translate an English UI string (falls back to the English text). */
export function t(text: string): string {
  if (!IS_AR || !text) return text;
  const direct = AR[text];
  if (direct) return direct;
  for (const [re, out] of AR_PATTERNS) if (re.test(text)) return text.replace(re, out);
  return text;
}

/** Switch language: remembers it, flips the layout direction and restarts the app. */
export async function setLanguage(lang: Lang) {
  if (lang === LANG) return;
  const rtl = lang === 'ar';
  if (Platform.OS === 'web') {
    try {
      globalThis.localStorage?.setItem(WEB_KEY, lang);
    } catch {
      // ignore
    }
    globalThis.location?.reload();
    return;
  }
  I18nManager.allowRTL(rtl);
  I18nManager.forceRTL(rtl);
  try {
    await Updates.reloadAsync();
  } catch {
    DevSettings.reload();
  }
}
