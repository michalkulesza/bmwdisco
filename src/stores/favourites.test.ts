import Storage from 'expo-sqlite/kv-store';

import { useFavouritesStore } from './favourites';

const state = () => useFavouritesStore.getState();

describe('favourites store', () => {
  beforeEach(() => {
    useFavouritesStore.setState({ ids: ['a', 'b', 'c'], size: 'regular' });
  });

  it('adds ids once and keeps order', () => {
    state().add('d');
    state().add('a');

    expect(state().ids).toEqual(['a', 'b', 'c', 'd']);
  });

  it('removes an id', () => {
    state().remove('b');

    expect(state().ids).toEqual(['a', 'c']);
  });

  it('replaces the order and drops duplicates', () => {
    state().setOrder(['c', 'a', 'b', 'a']);

    expect(state().ids).toEqual(['c', 'a', 'b']);
  });

  it('sets the tile size', () => {
    state().setSize('large');

    expect(state().size).toBe('large');
  });

  it('persists and restores, ignoring malformed data', async () => {
    state().setSize('small');
    expect(Storage.getItemSync('favourites')).toContain('"small"');

    useFavouritesStore.setState({ size: 'large' });
    Storage.setItemSync(
      'favourites',
      JSON.stringify({ state: { ids: ['x', 5, 'y'], size: 'huge' }, version: 1 }),
    );
    await useFavouritesStore.persist.rehydrate();

    expect(state().ids).toEqual(['x', 'y']);
    expect(state().size).toBe('large');
  });
});
