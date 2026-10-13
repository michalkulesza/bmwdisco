import { jest } from '@jest/globals';
import { render } from '@testing-library/react-native';
import { FlatList } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import type { ComponentProps, ReactElement, ReactNode } from 'react';

const METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

export const renderScreen = (ui: ReactElement) =>
  render(<SafeAreaProvider initialMetrics={METRICS}>{ui}</SafeAreaProvider>);

export const routerMock = {
  push: jest.fn(),
  back: jest.fn(),
  replace: jest.fn(),
  navigate: jest.fn(),
};

export const searchParams: Record<string, string | undefined> = {};

export const resetRouter = () => {
  Object.values(routerMock).forEach((fn) => fn.mockClear());
  Object.keys(searchParams).forEach((key) => delete searchParams[key]);
};

interface CustomHeaderItem {
  type: 'custom';
  element: ReactNode;
}

interface StackScreenOptions {
  unstable_headerLeftItems?: () => CustomHeaderItem[];
  unstable_headerRightItems?: () => CustomHeaderItem[];
}

const StackScreen = ({ options }: { options?: StackScreenOptions }) => (
  <>
    {options?.unstable_headerLeftItems?.().map((item) => item.element)}
    {options?.unstable_headerRightItems?.().map((item) => item.element)}
  </>
);

export const routerModule = {
  useRouter: () => routerMock,
  useLocalSearchParams: () => searchParams,
  Stack: { Screen: StackScreen },
};

export const toastShow = jest.fn();

export const toastModule = {
  useToast: () => ({ show: toastShow, close: jest.fn(), closeAll: jest.fn() }),
};

type ReorderableProps = ComponentProps<typeof FlatList> & {
  onReorder: (event: { from: number; to: number }) => void;
};

export const reorderable = {
  props: undefined as ReorderableProps | undefined,
  capture(props: ReorderableProps) {
    this.props = props;
  },
};

const ReorderableList = (props: ReorderableProps) => {
  reorderable.capture(props);

  return <FlatList {...props} />;
};

export const reorderableModule = {
  __esModule: true,
  default: ReorderableList,
  useReorderableDrag: () => jest.fn(),
};
