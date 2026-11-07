export const Brand = {
  violet: '#493BEA',
  blue: '#2452DB',
  softPurple: '#A66BFA',
  lavender: '#F5F4FF',
  navy: '#17172B',
  danger: '#E5484D',
  success: '#1F9D63',
  gold: '#C9A24B',
};

export type Palette = {
  bg: string;
  surface: string;
  surfaceAlt: string;
  text: string;
  textMuted: string;
  border: string;
  primary: string;
  primarySoft: string;
  icon: string;
  shadow: string;
  dangerSoft: string;
};

export const LightPalette: Palette = {
  bg: '#F7F6FF',
  surface: '#FFFFFF',
  surfaceAlt: '#F0EEFF',
  text: Brand.navy,
  textMuted: '#6B6B85',
  border: '#ECEAF7',
  primary: Brand.violet,
  primarySoft: '#EEEBFF',
  icon: '#5E5E78',
  shadow: '#5B4BEA',
  dangerSoft: '#FDECEC',
};

export const DarkPalette: Palette = {
  bg: '#0F0F1E',
  surface: '#1A1A30',
  surfaceAlt: '#23233F',
  text: '#F3F2FF',
  textMuted: '#A3A3C2',
  border: '#2A2A48',
  primary: '#8B7FFF',
  primarySoft: '#2A2756',
  icon: '#B9B8D6',
  shadow: '#000000',
  dangerSoft: '#3A1E24',
};

export const HeaderGradient = ['#2F4FD8', '#5B4BE6', '#7A5CF0', '#A66BFA'] as const;

export const Font = {
  regular: 'PlusJakartaSans_400Regular',
  medium: 'PlusJakartaSans_500Medium',
  semibold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
  extrabold: 'PlusJakartaSans_800ExtraBold',
};

export const Radius = { sm: 10, md: 14, lg: 18, xl: 24, pill: 999 };

/** Telegram contact for subscriptions / support. Change to the real handle. */
export const TELEGRAM_URL = 'https://t.me/booklit_support';
