import { useTranslation } from 'react-i18next';
import Svg, { Path, Rect } from 'react-native-svg';

const VIEWBOX_SIZE = 120;
const CELL_SIZE = 8;
const CELL_RADIUS = 2;
const SPARKLE_PATH = 'M98 16Q98 24 103.6 24Q98 24 98 32Q98 24 92.4 24Q98 24 98 16Z';
const SPARKLE_FILL = '#F7F8FA';

const CELLS: readonly (readonly [number, number, string])[] = [
  [41, 21, '#617189'],
  [51, 21, '#5A6980'],
  [61, 21, '#505E74'],
  [71, 21, '#465366'],
  [31, 31, '#6D7F99'],
  [41, 31, '#F7F8FA'],
  [51, 31, '#5E6D85'],
  [61, 31, '#536177'],
  [71, 31, '#6CB4EE'],
  [81, 31, '#2F5FB3'],
  [21, 41, '#617189'],
  [31, 41, '#F7F8FA'],
  [41, 41, '#F7F8FA'],
  [51, 41, '#5C6C83'],
  [61, 41, '#6CB4EE'],
  [71, 41, '#2F5FB3'],
  [81, 41, '#E4342B'],
  [91, 41, '#323C4D'],
  [21, 51, '#5A6980'],
  [31, 51, '#5E6D85'],
  [41, 51, '#5C6C83'],
  [51, 51, '#6CB4EE'],
  [61, 51, '#2F5FB3'],
  [71, 51, '#E4342B'],
  [81, 51, '#3A4557'],
  [91, 51, '#2F3A4A'],
  [21, 61, '#505E74'],
  [31, 61, '#536177'],
  [41, 61, '#5E86AC'],
  [51, 61, '#2F5FB3'],
  [61, 61, '#E4342B'],
  [71, 61, '#3E4A5D'],
  [81, 61, '#354051'],
  [91, 61, '#2C3544'],
  [21, 71, '#465366'],
  [31, 71, '#5880A5'],
  [41, 71, '#3C598A'],
  [51, 71, '#E4342B'],
  [61, 71, '#3E4A5D'],
  [71, 71, '#374254'],
  [81, 71, '#2F3949'],
  [91, 71, '#262F3E'],
  [31, 81, '#375383'],
  [41, 81, '#883F45'],
  [51, 81, '#3A4557'],
  [61, 81, '#354051'],
  [71, 81, '#2F3949'],
  [81, 81, '#283140'],
  [41, 91, '#323C4D'],
  [51, 91, '#2F3A4A'],
  [61, 91, '#2C3544'],
  [71, 91, '#262F3E'],
];

type LogoProps = {
  size?: number;
};

const Logo = ({ size = 120 }: LogoProps) => {
  const { t } = useTranslation();

  return (
    <Svg
      width={size}
      height={size}
      viewBox={`0 0 ${VIEWBOX_SIZE} ${VIEWBOX_SIZE}`}
      accessible
      accessibilityRole="image"
      accessibilityLabel={t('common.logo')}
    >
      {CELLS.map(([x, y, fill]) => (
        <Rect
          key={`${x}-${y}`}
          x={x}
          y={y}
          width={CELL_SIZE}
          height={CELL_SIZE}
          rx={CELL_RADIUS}
          fill={fill}
        />
      ))}
      <Path d={SPARKLE_PATH} fill={SPARKLE_FILL} />
    </Svg>
  );
};

export default Logo;
