import { memo, useCallback, useState } from 'react';
import { Checkbox, DropdownMenu, DropdownMenuItem, Host, OutlinedButton, Text } from '@expo/ui/jetpack-compose';
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
  const [expanded, setExpanded] = useState(false);
  const handleOpen = useCallback(() => setExpanded(true), []);
  const handleDismiss = useCallback(() => setExpanded(false), []);
  const toggle = (id: ElementId, on: boolean) => onChange(on ? [...selected, id] : selected.filter(value => value !== id));

  return <Host matchContents colorScheme="dark" style={{ alignSelf: 'flex-start', maxWidth: '100%' }}>
    <DropdownMenu expanded={expanded} onDismissRequest={handleDismiss}>
      <DropdownMenu.Trigger>
        <OutlinedButton enabled={!busy} onClick={handleOpen}>
          <Text>{summarize(selected)}</Text>
        </OutlinedButton>
      </DropdownMenu.Trigger>
      <DropdownMenu.Items>
        {LIGHT_GROUPS.flatMap(group => [
          <DropdownMenuItem key={group} enabled={false}>
            <DropdownMenuItem.Text><Text style={{ fontWeight: '700' }}>{group.toUpperCase()}</Text></DropdownMenuItem.Text>
          </DropdownMenuItem>,
          ...LIGHT_ELEMENTS.filter(light => light.group === group).map(light => {
            const missing = vehicle && !vehicle.elements[light.id];
            const label = missing ? `${light.label} (not on ${vehicle.chassis})` : light.label;
            const isOn = selected.includes(light.id);
            return <DropdownMenuItem key={light.id} onClick={() => toggle(light.id, !isOn)}>
              <DropdownMenuItem.Text><Text>{label}</Text></DropdownMenuItem.Text>
              <DropdownMenuItem.TrailingIcon><Checkbox value={isOn} onCheckedChange={on => toggle(light.id, on)} /></DropdownMenuItem.TrailingIcon>
            </DropdownMenuItem>;
          }),
        ])}
      </DropdownMenu.Items>
    </DropdownMenu>
  </Host>;
};

export default memo(LightPicker);
