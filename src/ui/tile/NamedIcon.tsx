import { DEFAULT_ICON, ICON_REGISTRY, isIconName } from './icon-registry';

interface NamedIconProps {
  name: string;
  size: number;
  color: string | undefined;
}

const NamedIcon = ({ name, size, color }: NamedIconProps) => {
  const entry = isIconName(name) ? ICON_REGISTRY[name] : ICON_REGISTRY[DEFAULT_ICON];
  const IconComponent = entry.icon;

  return <IconComponent size={size} color={color} />;
};

export default NamedIcon;
