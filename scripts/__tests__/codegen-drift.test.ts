import { execFileSync } from 'node:child_process';
import path from 'node:path';

import { ROOT } from '../gen-data/paths';

describe('codegen drift', () => {
  it('matches the committed output of scripts/gen-data.ts', () => {
    const tsx = path.join(ROOT, 'node_modules', '.bin', 'tsx');

    expect(() =>
      execFileSync(tsx, ['scripts/gen-data.ts', '--check'], { cwd: ROOT, stdio: 'pipe' }),
    ).not.toThrow();
  }, 60_000);
});
