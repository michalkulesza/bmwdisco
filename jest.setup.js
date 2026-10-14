jest.mock('expo-sqlite/kv-store', () => {
  const store = new Map();
  return {
    __esModule: true,
    default: {
      getItemSync: (key) => store.get(key) ?? null,
      setItemSync: (key, value) => {
        store.set(key, value);
      },
      removeItemSync: (key) => store.delete(key),
    },
  };
});

jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
}));

jest.mock('@sentry/react-native', () => ({
  init: jest.fn(),
  wrap: jest.fn((component) => component),
  captureFeedback: jest.fn(),
  flush: jest.fn(() => Promise.resolve(true)),
}));

if (typeof window !== 'undefined' && !window.screen) {
  window.screen = {};
}
