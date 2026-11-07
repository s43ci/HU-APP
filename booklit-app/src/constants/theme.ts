export const Brand = {
  violet: '#493BEA',
  blue: '#2452DB',
  softPurple: '#A66BFA',
  lavender: '#F5F4FF',
  navy: '#17172B',
  danger: '#E5484D',
  success: '#16A34A',
  warning: '#D97706',
};

export type Palette = {
  bg: string;
  surface: string;
  surfaceAlt: string;
  text: string;
  textMuted: string;
  textFaint: string;
  border: string;
  primary: string;
  primarySoft: string;
  /** "Ink" = the solid dark pill used for active chips & primary buttons. */
  ink: string;
  onInk: string;
  icon: string;
  shadow: string;
  dangerSoft: string;
  navBar: string;
};

export const LightPalette: Palette = {
  bg: '#F4F4F8',
  surface: '#FFFFFF',
  surfaceAlt: '#EEEDF5',
  text: '#17172B',
  textMuted: '#7C7C93',
  textFaint: '#A9A9BC',
  border: '#E8E7F0',
  primary: '#493BEA',
  primarySoft: '#EDEBFE',
  ink: '#17172B',
  onInk: '#FFFFFF',
  icon: '#3F3F55',
  shadow: '#1E1B4B',
  dangerSoft: '#FDEEEE',
  navBar: '#17172B',
};

export const DarkPalette: Palette = {
  bg: '#0D0D14',
  surface: '#181824',
  surfaceAlt: '#222233',
  text: '#F1F1F7',
  textMuted: '#9A9AB2',
  textFaint: '#5F5F78',
  border: '#272739',
  primary: '#8D83FF',
  primarySoft: '#25224A',
  ink: '#F1F1F7',
  onInk: '#0D0D14',
  icon: '#C9C9DA',
  shadow: '#000000',
  dangerSoft: '#34191D',
  navBar: '#232336',
};

/** Reader page themes (Kindle-style). */
export const ReaderThemes = {
  light: { bg: '#FFFFFF', text: '#1B1B26', muted: '#7A7A8C', border: '#ECECF2', chrome: '#FFFFFF' },
  sepia: { bg: '#F7F0E3', text: '#3B2F22', muted: '#8C7B66', border: '#E7DCC8', chrome: '#F7F0E3' },
  dark: { bg: '#121218', text: '#E6E6EE', muted: '#8E8EA3', border: '#25252F', chrome: '#121218' },
} as const;
export type ReaderTheme = keyof typeof ReaderThemes;

export const Font = {
  light: 'PlusJakartaSans_300Light',
  regular: 'PlusJakartaSans_400Regular',
  medium: 'PlusJakartaSans_500Medium',
  semibold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
};

/** Type scale: keep it small and calm. */
export const Type = { display: 28, title: 22, h2: 17, body: 14.5, small: 13, tiny: 11.5 };

export const Radius = { sm: 10, md: 14, lg: 20, xl: 26, pill: 999 };

/** Space reserved at the bottom of tab screens for the floating nav bar. */
export const TAB_BAR_SPACE = 112;

/** Telegram contact for subscriptions / support. Change to the real handle. */
export const TELEGRAM_URL = 'https://t.me/booklit_support';
