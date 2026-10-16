import { execFileSync } from 'node:child_process';

import { ROOT } from '../gen-data/paths';

describe('codegen drift', () => {
  it('matches the committed output of scripts/gen-data.ts', () => {
    const tsx = require.resolve('tsx/cli');

    expect(() =>
      execFileSync(process.execPath, [tsx, 'scripts/gen-data.ts', '--check'], {
        cwd: ROOT,
        stdio: 'pipe',
      }),
    ).not.toThrow();
  }, 60_000);
});
