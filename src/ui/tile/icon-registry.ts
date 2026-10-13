import { AlienIcon } from 'phosphor-react-native/src/icons/Alien';
import { ArrowBendUpLeftIcon } from 'phosphor-react-native/src/icons/ArrowBendUpLeft';
import { ArrowBendUpRightIcon } from 'phosphor-react-native/src/icons/ArrowBendUpRight';
import { ArrowLeftIcon } from 'phosphor-react-native/src/icons/ArrowLeft';
import { ArrowRightIcon } from 'phosphor-react-native/src/icons/ArrowRight';
import { BellIcon } from 'phosphor-react-native/src/icons/Bell';
import { CarIcon } from 'phosphor-react-native/src/icons/Car';
import { CarProfileIcon } from 'phosphor-react-native/src/icons/CarProfile';
import { CarSimpleIcon } from 'phosphor-react-native/src/icons/CarSimple';
import { CloudFogIcon } from 'phosphor-react-native/src/icons/CloudFog';
import { ConfettiIcon } from 'phosphor-react-native/src/icons/Confetti';
import { CrownIcon } from 'phosphor-react-native/src/icons/Crown';
import { DiscoBallIcon } from 'phosphor-react-native/src/icons/DiscoBall';
import { DoorIcon } from 'phosphor-react-native/src/icons/Door';
import { EngineIcon } from 'phosphor-react-native/src/icons/Engine';
import { FireIcon } from 'phosphor-react-native/src/icons/Fire';
import { FlagCheckeredIcon } from 'phosphor-react-native/src/icons/FlagCheckered';
import { FlashlightIcon } from 'phosphor-react-native/src/icons/Flashlight';
import { GarageIcon } from 'phosphor-react-native/src/icons/Garage';
import { GaugeIcon } from 'phosphor-react-native/src/icons/Gauge';
import { GhostIcon } from 'phosphor-react-native/src/icons/Ghost';
import { HeadlightsIcon } from 'phosphor-react-native/src/icons/Headlights';
import { HeartIcon } from 'phosphor-react-native/src/icons/Heart';
import { KeyIcon } from 'phosphor-react-native/src/icons/Key';
import { LampIcon } from 'phosphor-react-native/src/icons/Lamp';
import { LightbulbIcon } from 'phosphor-react-native/src/icons/Lightbulb';
import { LightbulbFilamentIcon } from 'phosphor-react-native/src/icons/LightbulbFilament';
import { LighthouseIcon } from 'phosphor-react-native/src/icons/Lighthouse';
import { LightningIcon } from 'phosphor-react-native/src/icons/Lightning';
import { MoonIcon } from 'phosphor-react-native/src/icons/Moon';
import { MoonStarsIcon } from 'phosphor-react-native/src/icons/MoonStars';
import { MusicNotesIcon } from 'phosphor-react-native/src/icons/MusicNotes';
import { PowerIcon } from 'phosphor-react-native/src/icons/Power';
import { PulseIcon } from 'phosphor-react-native/src/icons/Pulse';
import { RainbowIcon } from 'phosphor-react-native/src/icons/Rainbow';
import { RocketIcon } from 'phosphor-react-native/src/icons/Rocket';
import { SirenIcon } from 'phosphor-react-native/src/icons/Siren';
import { SkullIcon } from 'phosphor-react-native/src/icons/Skull';
import { SmileyIcon } from 'phosphor-react-native/src/icons/Smiley';
import { SparkleIcon } from 'phosphor-react-native/src/icons/Sparkle';
import { StarIcon } from 'phosphor-react-native/src/icons/Star';
import { SteeringWheelIcon } from 'phosphor-react-native/src/icons/SteeringWheel';
import { SunIcon } from 'phosphor-react-native/src/icons/Sun';
import { SunDimIcon } from 'phosphor-react-native/src/icons/SunDim';
import { TireIcon } from 'phosphor-react-native/src/icons/Tire';
import { TrafficSignalIcon } from 'phosphor-react-native/src/icons/TrafficSignal';
import { WarningIcon } from 'phosphor-react-native/src/icons/Warning';
import { WarningOctagonIcon } from 'phosphor-react-native/src/icons/WarningOctagon';
import { WaveformIcon } from 'phosphor-react-native/src/icons/Waveform';
import { WindIcon } from 'phosphor-react-native/src/icons/Wind';

import type { Icon } from 'phosphor-react-native';

export type IconCategory = 'lights' | 'signals' | 'vehicle' | 'fun';

export const ICON_CATEGORIES: readonly IconCategory[] = ['lights', 'signals', 'vehicle', 'fun'];

interface IconEntry {
  icon: Icon;
  category: IconCategory;
}

export const ICON_REGISTRY = {
  Headlights: { icon: HeadlightsIcon, category: 'lights' },
  Lightbulb: { icon: LightbulbIcon, category: 'lights' },
  LightbulbFilament: { icon: LightbulbFilamentIcon, category: 'lights' },
  Flashlight: { icon: FlashlightIcon, category: 'lights' },
  Sun: { icon: SunIcon, category: 'lights' },
  SunDim: { icon: SunDimIcon, category: 'lights' },
  Moon: { icon: MoonIcon, category: 'lights' },
  MoonStars: { icon: MoonStarsIcon, category: 'lights' },
  Lamp: { icon: LampIcon, category: 'lights' },
  Lighthouse: { icon: LighthouseIcon, category: 'lights' },
  Sparkle: { icon: SparkleIcon, category: 'lights' },
  Lightning: { icon: LightningIcon, category: 'lights' },
  Fire: { icon: FireIcon, category: 'lights' },
  ArrowBendUpLeft: { icon: ArrowBendUpLeftIcon, category: 'signals' },
  ArrowBendUpRight: { icon: ArrowBendUpRightIcon, category: 'signals' },
  ArrowLeft: { icon: ArrowLeftIcon, category: 'signals' },
  ArrowRight: { icon: ArrowRightIcon, category: 'signals' },
  Warning: { icon: WarningIcon, category: 'signals' },
  WarningOctagon: { icon: WarningOctagonIcon, category: 'signals' },
  Siren: { icon: SirenIcon, category: 'signals' },
  TrafficSignal: { icon: TrafficSignalIcon, category: 'signals' },
  Bell: { icon: BellIcon, category: 'signals' },
  Pulse: { icon: PulseIcon, category: 'signals' },
  Waveform: { icon: WaveformIcon, category: 'signals' },
  Power: { icon: PowerIcon, category: 'signals' },
  CloudFog: { icon: CloudFogIcon, category: 'signals' },
  Car: { icon: CarIcon, category: 'vehicle' },
  CarProfile: { icon: CarProfileIcon, category: 'vehicle' },
  CarSimple: { icon: CarSimpleIcon, category: 'vehicle' },
  Engine: { icon: EngineIcon, category: 'vehicle' },
  Gauge: { icon: GaugeIcon, category: 'vehicle' },
  SteeringWheel: { icon: SteeringWheelIcon, category: 'vehicle' },
  Tire: { icon: TireIcon, category: 'vehicle' },
  Key: { icon: KeyIcon, category: 'vehicle' },
  Door: { icon: DoorIcon, category: 'vehicle' },
  Garage: { icon: GarageIcon, category: 'vehicle' },
  FlagCheckered: { icon: FlagCheckeredIcon, category: 'vehicle' },
  Wind: { icon: WindIcon, category: 'vehicle' },
  Confetti: { icon: ConfettiIcon, category: 'fun' },
  DiscoBall: { icon: DiscoBallIcon, category: 'fun' },
  Ghost: { icon: GhostIcon, category: 'fun' },
  Heart: { icon: HeartIcon, category: 'fun' },
  Star: { icon: StarIcon, category: 'fun' },
  Rocket: { icon: RocketIcon, category: 'fun' },
  Skull: { icon: SkullIcon, category: 'fun' },
  MusicNotes: { icon: MusicNotesIcon, category: 'fun' },
  Rainbow: { icon: RainbowIcon, category: 'fun' },
  Crown: { icon: CrownIcon, category: 'fun' },
  Alien: { icon: AlienIcon, category: 'fun' },
  Smiley: { icon: SmileyIcon, category: 'fun' },
} as const satisfies Record<string, IconEntry>;

export type IconName = keyof typeof ICON_REGISTRY;

export const ICON_NAMES = Object.keys(ICON_REGISTRY) as IconName[];

export const DEFAULT_ICON: IconName = 'Lightning';

export const isIconName = (value: string): value is IconName => value in ICON_REGISTRY;

export const iconByName = (name: string): Icon =>
  isIconName(name) ? ICON_REGISTRY[name].icon : ICON_REGISTRY[DEFAULT_ICON].icon;
