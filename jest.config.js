const fs = require('fs');
const path = require('path');

const COVERED_DIRS = ['src/protocol', 'src/link', 'src/domain', 'src/simulator'];
const THRESHOLD = { statements: 90, branches: 90, functions: 90, lines: 90 };

const hasSources = (dir) => {
  const abs = path.join(__dirname, dir);
  if (!fs.existsSync(abs)) return false;
  return fs
    .readdirSync(abs, { recursive: true })
    .some((file) => /\.tsx?$/.test(String(file)) && !/\.test\.tsx?$/.test(String(file)));
};

const activeDirs = COVERED_DIRS.filter(hasSources);

module.exports = {
  preset: 'jest-expo',
  testPathIgnorePatterns: ['/node_modules/', '/PROTO/', '/btool-apk/', '/e2e/', '/.claude/'],
  modulePathIgnorePatterns: ['<rootDir>/PROTO/', '<rootDir>/btool-apk/', '<rootDir>/.claude/'],
  transformIgnorePatterns: [
    'node_modules/(?!(\\.pnpm|(jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|react-native-svg|@gluestack-ui/.*|nativewind|react-native-css|tailwind-variants|phosphor-react-native|react-native-reanimated|react-native-worklets|react-native-gesture-handler))',
  ],
  setupFiles: ['<rootDir>/jest.setup.js'],
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
  collectCoverageFrom: [
    ...COVERED_DIRS.map((dir) => `${dir}/**/*.{ts,tsx}`),
    '!**/*.test.{ts,tsx}',
  ],
  coverageThreshold: Object.fromEntries(activeDirs.map((dir) => [`./${dir}/`, THRESHOLD])),
};
