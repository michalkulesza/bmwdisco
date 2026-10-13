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
  testPathIgnorePatterns: ['/node_modules/', '/PROTO/', '/e2e/', '/.claude/'],
  modulePathIgnorePatterns: ['<rootDir>/PROTO/', '<rootDir>/.claude/'],
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
  collectCoverageFrom: [
    ...COVERED_DIRS.map((dir) => `${dir}/**/*.{ts,tsx}`),
    '!**/*.test.{ts,tsx}',
  ],
  coverageThreshold: Object.fromEntries(activeDirs.map((dir) => [`./${dir}/`, THRESHOLD])),
};
