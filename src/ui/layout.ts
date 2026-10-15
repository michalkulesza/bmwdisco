import { Platform } from 'react-native';

export const SCREEN_TOP_PADDING = Platform.select({ android: 24, default: 8 });
