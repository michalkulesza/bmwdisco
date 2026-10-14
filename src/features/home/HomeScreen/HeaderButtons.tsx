import { View } from 'react-native';

import ReportButton from './ReportButton';
import SettingsButton from './SettingsButton';

const HeaderButtons = () => (
  <View className="flex-row items-center">
    <ReportButton />
    <SettingsButton />
  </View>
);

export default HeaderButtons;
