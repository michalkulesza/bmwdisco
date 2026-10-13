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
}));

if (typeof window !== 'undefined' && !window.screen) {
  window.screen = {};
}
