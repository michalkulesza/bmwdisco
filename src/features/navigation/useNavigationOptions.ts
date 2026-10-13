import { DefaultTheme, type Theme } from 'expo-router/react-navigation';
import { useMemo } from 'react';

import { useColorToken, useFontToken } from '@/ui/theme';

export const useNavigationTheme = (): Theme => {
  const page = useColorToken('page');
  const card = useColorToken('card');
  const text = useColorToken('text');
  const border = useColorToken('card-border');
  const primary = useColorToken('primary');

  return useMemo(
    () => ({
      ...DefaultTheme,
      colors: {
        primary: primary ?? DefaultTheme.colors.primary,
        background: page ?? DefaultTheme.colors.background,
        card: card ?? DefaultTheme.colors.card,
        text: text ?? DefaultTheme.colors.text,
        border: border ?? DefaultTheme.colors.border,
        notification: DefaultTheme.colors.notification,
      },
    }),
    [primary, page, card, text, border],
  );
};

export const useStackScreenOptions = () => {
  const page = useColorToken('page');
  const text = useColorToken('text');
  const semibold = useFontToken('geist-semibold');
  const bold = useFontToken('geist-bold');

  return useMemo(
    () => ({
      headerStyle: { backgroundColor: page },
      headerTintColor: text,
      headerTitleStyle: { color: text, fontFamily: semibold },
      headerLargeStyle: { backgroundColor: page },
      headerLargeTitleStyle: { color: text, fontFamily: bold },
      headerShadowVisible: false,
      headerLargeTitleShadowVisible: false,
      headerBackButtonDisplayMode: 'minimal' as const,
      contentStyle: { backgroundColor: page },
    }),
    [page, text, semibold, bold],
  );
};

export const useSheetOptions = () => {
  const sheet = useColorToken('sheet');

  return useMemo(
    () => ({
      presentation: 'formSheet' as const,
      headerShown: false,
      sheetGrabberVisible: true,
      sheetCornerRadius: 28,
      sheetAllowedDetents: [0.6, 1],
      contentStyle: { backgroundColor: sheet },
    }),
    [sheet],
  );
};
