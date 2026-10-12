import { memo } from 'react';
import { Host, Menu, Section, Toggle } from '@expo/ui/swift-ui';
import { disabled, menuActionDismissBehavior } from '@expo/ui/swift-ui/modifiers';
import { ElementId, LIGHT_ELEMENTS, LIGHT_GROUPS, elementLabel } from '../presets';
import type { VehicleProfile } from '../protocol/profiles';

interface Props {
  selected: readonly ElementId[];
  vehicle: VehicleProfile | null;
  busy: boolean;
  onChange: (elements: ElementId[]) => void;
}

const summarize = (selected: readonly ElementId[]) => {
  if (!selected.length) return 'Choose lights';
  if (selected.length <= 2) return selected.map(elementLabel).join(', ');
  return `${selected.length} lights`;
};

const LightPicker = ({ selected, vehicle, busy, onChange }: Props) => {
  const toggle = (id: ElementId, on: boolean) => onChange(on ? [...selected, id] : selected.filter(value => value !== id));
  const menuModifiers = [menuActionDismissBehavior('disabled'), disabled(busy)];

  return <Host matchContents colorScheme="dark" style={{ alignSelf: 'flex-start', maxWidth: '100%' }}>
    <Menu label={summarize(selected)} modifiers={menuModifiers}>
      {LIGHT_GROUPS.map(group => <Section key={group} title={group}>
        {LIGHT_ELEMENTS.filter(light => light.group === group).map(light => {
          const missing = vehicle && !vehicle.elements[light.id];
          const label = missing ? `${light.label} (not on ${vehicle.chassis})` : light.label;
          return <Toggle key={light.id} label={label} isOn={selected.includes(light.id)} onIsOnChange={on => toggle(light.id, on)} />;
        })}
      </Section>)}
    </Menu>
  </Host>;
};

export default memo(LightPicker);
