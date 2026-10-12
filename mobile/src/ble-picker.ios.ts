import { ActionSheetIOS } from 'react-native';
import { BleAdvert, candidateLabel } from './protocol/elm';

export function chooseDevice(candidates: BleAdvert[]): Promise<string | null> {
  return new Promise(resolve => {
    const cancelButtonIndex = candidates.length;
    ActionSheetIOS.showActionSheetWithOptions(
      { title: 'Choose Bluetooth adapter', options: [...candidates.map(candidateLabel), 'Cancel'], cancelButtonIndex },
      index => resolve(index === cancelButtonIndex ? null : candidates[index].id),
    );
  });
}
