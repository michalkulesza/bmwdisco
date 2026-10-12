import { PlatformColor, Platform } from 'react-native';

export const success = Platform.select({
  ios: PlatformColor('systemGreen'),
  default: PlatformColor('@android:color/holo_green_dark'),
});

export const danger = Platform.select({
  ios: PlatformColor('systemRed'),
  default: PlatformColor('@android:color/holo_red_light'),
});
