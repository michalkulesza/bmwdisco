import * as Haptics from 'expo-haptics';

export const selectionHaptic = () => {
  void Haptics.selectionAsync();
};
