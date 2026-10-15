import { View } from 'react-native';

import ReportButton from './ReportButton';
import SettingsButton from './SettingsButton';

const HeaderButtons = () => (
  <View className="flex-row items-center android:pr-2">
    <ReportButton />
    <SettingsButton />
  </View>
);

export default HeaderButtons;
