import { Appearance } from 'react-native';
import { useNativeVariable } from 'react-native-css/native';

import type { ThemeMode } from '@/stores/settings';

export type ColorToken =
  | 'page'
  | 'card'
  | 'card-border'
  | 'sheet'
  | 'border'
  | 'text'
  | 'text-soft'
  | 'text-muted'
  | 'chevron'
  | 'primary'
  | 'on-primary'
  | 'destructive'
  | 'connected'
  | 'blue'
  | 'amber'
  | 'teal'
  | 'lime'
  | 'rose'
  | 'violet'
  | 'lilac'
  | 'neutral';

export type HueToken = Extract<
  ColorToken,
  'blue' | 'amber' | 'teal' | 'lime' | 'rose' | 'violet' | 'lilac' | 'neutral'
>;

export type FontToken = 'geist' | 'geist-medium' | 'geist-semibold' | 'geist-bold' | 'geist-mono';

export const useColorToken = (token: ColorToken) =>
  useNativeVariable(`--${token}`) as string | undefined;

export const useFontToken = (token: FontToken) =>
  useNativeVariable(`--font-${token}`) as string | undefined;

export const applyThemeMode = (mode: ThemeMode) => {
  Appearance.setColorScheme(mode === 'system' ? 'unspecified' : mode);
};
