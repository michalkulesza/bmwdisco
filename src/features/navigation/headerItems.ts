import { Platform } from 'react-native';

import type { NativeStackHeaderItem, NativeStackNavigationOptions } from 'expo-router';
import type { ReactElement } from 'react';

type HeaderOptions = Pick<
  NativeStackNavigationOptions,
  'headerLeft' | 'headerRight' | 'unstable_headerLeftItems' | 'unstable_headerRightItems'
>;

const toHeaderItems = (element: ReactElement) => (): NativeStackHeaderItem[] => [
  { type: 'custom', element, hidesSharedBackground: true },
];

const toHeaderRender = (element: ReactElement) => () => element;

export const headerRightOptions = (element: ReactElement): HeaderOptions =>
  Platform.OS === 'ios'
    ? { unstable_headerRightItems: toHeaderItems(element) }
    : { headerRight: toHeaderRender(element) };

export const headerLeftOptions = (element: ReactElement): HeaderOptions =>
  Platform.OS === 'ios'
    ? { unstable_headerLeftItems: toHeaderItems(element) }
    : { headerLeft: toHeaderRender(element) };
