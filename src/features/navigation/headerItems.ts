import type { NativeStackHeaderItem } from 'expo-router';
import type { ReactElement } from 'react';

export const toHeaderItems = (element: ReactElement) => (): NativeStackHeaderItem[] => [
  { type: 'custom', element, hidesSharedBackground: true },
];
