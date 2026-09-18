/**
 * Snowpace design tokens, ported from the design system's styles.css.
 * Colour is the only thing that changes between light and dark; type,
 * spacing and radii are shared.
 */
import { Platform, type TextStyle, type ViewStyle } from 'react-native';

export type Scheme = 'light' | 'dark';

// Tonal ramps — identical in both themes; the role tokens below are what flip.
export const ramps = {
  neutral: {
    100: '#f7f9fb', 200: '#e9eef4', 300: '#d3dce6', 400: '#b0bdcc', 500: '#8a99ac',
    600: '#6a798d', 700: '#4e5c70', 800: '#364354', 900: '#1e2a3a',
  },
  accent: {
    100: '#eef5fa', 200: '#d5e7f3', 300: '#aed0e7', 400: '#74aad0', 500: '#3d84ac',
    600: '#24678e', 700: '#1a4f6e', 800: '#133a51', 900: '#0d2637',
  },
  accent2: {
    100: '#fdf6e3', 200: '#faeac0', 300: '#f2d68a', 400: '#e0b850', 500: '#c4951b',
    600: '#a67b0a', 700: '#856107', 800: '#5f4606', 900: '#3d2d05',
  },
  success: {
    100: '#eef8f3', 200: '#d0ece0', 300: '#a3d9c3', 400: '#62bd9c', 500: '#2f9d77',
    600: '#17835e', 700: '#12704f', 800: '#0d523a', 900: '#083626',
  },
  danger: {
    100: '#fdf0f2', 200: '#f9d6dc', 300: '#f1adb9', 400: '#e37b8d', 500: '#d14b63',
    600: '#be3049', 700: '#b32438', 800: '#821a29', 900: '#55111b',
  },
} as const;

export type Pair = { bg: string; fg: string };

export type Theme = {
  scheme: Scheme;
  bg: string;
  surface: string;
  text: string;
  muted: string;
  accent: string;
  accent2: string;
  success: string;
  danger: string;
  divider: string;
  track: string;
  warn: string;
  chipOn: Pair;
  tagAccent: Pair;
  tagNeutral: Pair;
  drag: Pair;
  score: { hi: Pair; go: Pair; fair: Pair; poor: Pair; skip: Pair; none: Pair };
  ringFair: string;
  ringNone: string;
  shadowSm: ViewStyle;
  ramps: typeof ramps;
};

// CSS `box-shadow: 0 1px 2px rgba(...)`. iOS shadow props and Android
// elevation are separate APIs, so both are set here.
function shadow(color: string, opacity: number): ViewStyle {
  return Platform.select<ViewStyle>({
    ios: { shadowColor: color, shadowOffset: { width: 0, height: 1 }, shadowRadius: 2, shadowOpacity: opacity },
    android: { elevation: 2, shadowColor: color },
    default: {},
  }) as ViewStyle;
}

const light: Theme = {
  scheme: 'light',
  bg: '#edf2f7',
  surface: '#ffffff',
  text: '#0f2440',
  muted: 'rgba(15,36,64,0.7)',
  accent: '#2a6f97',
  accent2: '#b57d0a',
  success: '#12704f',
  danger: '#b32438',
  divider: 'rgba(15,36,64,0.16)',
  track: ramps.neutral[200],
  warn: ramps.accent2[700],
  chipOn: { bg: '#2a6f97', fg: '#ffffff' },
  tagAccent: { bg: ramps.accent[100], fg: ramps.accent[800] },
  tagNeutral: { bg: ramps.neutral[100], fg: ramps.neutral[800] },
  drag: { bg: ramps.accent2[200], fg: ramps.accent2[900] },
  score: {
    hi: { bg: ramps.success[300], fg: ramps.success[900] },
    go: { bg: ramps.success[100], fg: ramps.success[800] },
    fair: { bg: ramps.accent2[100], fg: ramps.accent2[800] },
    poor: { bg: ramps.neutral[200], fg: ramps.neutral[800] },
    skip: { bg: ramps.danger[100], fg: ramps.danger[800] },
    none: { bg: ramps.neutral[200], fg: ramps.neutral[700] },
  },
  ringFair: ramps.accent2[500],
  ringNone: ramps.neutral[400],
  shadowSm: shadow('#1e2a3a', 0.14),
  ramps,
};

const dark: Theme = {
  scheme: 'dark',
  bg: '#0b1626',
  surface: '#14243a',
  text: '#e6eef7',
  muted: 'rgba(230,238,247,0.7)',
  accent: '#6fb3dd',
  accent2: '#e6b545',
  success: '#4fc48f',
  danger: '#ee8592',
  divider: 'rgba(230,238,247,0.18)',
  track: ramps.neutral[800],
  warn: '#e6b545',
  chipOn: { bg: '#6fb3dd', fg: ramps.accent[900] },
  tagAccent: { bg: ramps.accent[800], fg: ramps.accent[200] },
  tagNeutral: { bg: ramps.neutral[800], fg: ramps.neutral[200] },
  drag: { bg: ramps.accent2[800], fg: ramps.accent2[200] },
  score: {
    hi: { bg: ramps.success[700], fg: ramps.success[100] },
    go: { bg: ramps.success[800], fg: ramps.success[200] },
    fair: { bg: ramps.accent2[800], fg: ramps.accent2[200] },
    poor: { bg: ramps.neutral[800], fg: ramps.neutral[200] },
    skip: { bg: ramps.danger[800], fg: ramps.danger[200] },
    none: { bg: ramps.neutral[800], fg: ramps.neutral[300] },
  },
  ringFair: '#e6b545',
  ringNone: ramps.neutral[500],
  shadowSm: shadow('#03080f', 0.55),
  ramps,
};

export const themes: Record<Scheme, Theme> = { light, dark };

// Custom fonts on iOS need one family name per weight — fontWeight alone
// will not pick the bold file. These names match what expo-font registers.
export const fonts = {
  heading: 'Caprasimo_400Regular',
  body: 'Figtree_400Regular',
  bodyMedium: 'Figtree_500Medium',
  bodySemi: 'Figtree_600SemiBold',
  bodyBold: 'Figtree_700Bold',
  bodyExtra: 'Figtree_800ExtraBold',
} as const;

export function bodyFont(weight: 400 | 500 | 600 | 700 | 800 = 400): TextStyle {
  const family =
    weight >= 800 ? fonts.bodyExtra
      : weight >= 700 ? fonts.bodyBold
        : weight >= 600 ? fonts.bodySemi
          : weight >= 500 ? fonts.bodyMedium
            : fonts.body;
  return { fontFamily: family };
}

export const radius = { sm: 8, md: 16, lg: 28, card: 32, pill: 999 } as const;

// The screen gutter used throughout the design.
export const gutter = 22;

/** Blend two hex colours in sRGB — stands in for CSS color-mix(). */
export function mix(a: string, b: string, weightA: number): string {
  const pa = hexToRgb(a), pb = hexToRgb(b);
  const w = Math.max(0, Math.min(1, weightA));
  const c = pa.map((v, i) => Math.round(v * w + pb[i] * (1 - w)));
  return '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((ch) => ch + ch).join('') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
