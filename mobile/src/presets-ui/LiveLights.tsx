import { Text, View } from 'react-native';
import { ElementId, LIGHT_ELEMENTS, LIGHT_GROUPS } from '../presets';

const LiveLights = ({ active }: { active: ElementId[] }) => {
  if (!active.length) return <Text style={{ color: '#9BAAC1' }}>All lights off</Text>;

  return <View style={{ gap: 8 }}>
    {LIGHT_GROUPS.map(group => {
      const on = LIGHT_ELEMENTS.filter(light => light.group === group && active.includes(light.id));
      if (!on.length) return null;

      return <View key={group} style={{ borderRadius: 14, padding: 12, gap: 4, backgroundColor: '#F3AB42' }}>
        <Text style={{ color: '#261A09', fontSize: 13, fontWeight: '600', textTransform: 'uppercase' }}>{group}</Text>
        {on.map(light => <Text key={light.id} style={{ color: '#261A09' }}>{light.label}</Text>)}
      </View>;
    })}
  </View>;
};

export default LiveLights;
