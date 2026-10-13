import * as Haptics from 'expo-haptics';

export const selectionHaptic = () => {
  void Haptics.selectionAsync();
};

export const successHaptic = () => {
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
};

export const errorHaptic = () => {
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
};
