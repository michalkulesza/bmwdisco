import type { ElementId } from '../presets';
import type { VehicleProfile } from '../protocol/profiles';

interface Props {
  selected: readonly ElementId[];
  vehicle: VehicleProfile | null;
  busy: boolean;
  onChange: (elements: ElementId[]) => void;
}

declare const LightPicker: import('react').NamedExoticComponent<Props>;
export default LightPicker;
