import fs from 'node:fs';
import path from 'node:path';

import { format, resolveConfig } from 'prettier';

import { buildAll, type BuildResult } from './gen-data/build';
import { ECU_DATA_DIR, GENERATED_DIR } from './gen-data/paths';
import { loadRawData } from './gen-data/raw';

const formatFile = async (file: string, content: string) => {
  if (!file.endsWith('.ts')) return content;

  const config = (await resolveConfig(path.join(GENERATED_DIR, file))) ?? {};
  return format(content, { ...config, parser: 'typescript' });
};

const formatAll = async (files: Record<string, string>) =>
  Object.fromEntries(
    await Promise.all(
      Object.entries(files).map(async ([file, content]) => [file, await formatFile(file, content)]),
    ),
  );

const listFiles = (dir: string, base = dir): string[] =>
  fs.existsSync(dir)
    ? fs
        .readdirSync(dir, { withFileTypes: true })
        .filter((entry) => entry.name !== '.gitkeep')
        .flatMap((entry) =>
          entry.isDirectory()
            ? listFiles(path.join(dir, entry.name), base)
            : [path.relative(base, path.join(dir, entry.name)).split(path.sep).join('/')],
        )
    : [];

const writeAll = (dir: string, files: Record<string, string>) => {
  fs.rmSync(dir, { recursive: true, force: true });

  for (const [file, content] of Object.entries(files)) {
    const target = path.join(dir, file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
  }
};

const findDrift = (dir: string, files: Record<string, string>) => {
  const committed = listFiles(dir);
  const expected = Object.keys(files);

  const missing = expected.filter((file) => !committed.includes(file));
  const stale = committed.filter((file) => !expected.includes(file));
  const changed = expected.filter(
    (file) =>
      committed.includes(file) &&
      fs.readFileSync(path.join(dir, file), 'utf8').replace(/\r\n/g, '\n') !==
        files[file]?.replace(/\r\n/g, '\n'),
  );

  return [
    ...missing.map((file) => `missing: ${file}`),
    ...stale.map((file) => `stale: ${file}`),
    ...changed.map((file) => `changed: ${file}`),
  ];
};

const printSummary = (result: BuildResult, files: Record<string, string>) => {
  console.log('Modules');
  for (const report of result.moduleReports) {
    console.log(
      `  ${report.sgbd}: ${report.elementCount} elements, ${report.commandCount} commands, ` +
        `${report.unnamedRows} unnamed rows skipped, ${report.unassembled.length} unassembled`,
    );
    for (const item of report.unassembled) console.log(`    - ${item.label}: ${item.reason}`);
  }

  console.log('Effects');
  for (const report of result.effects.reports) {
    console.log(`  ${report.pack}: kept ${report.kept}/${report.total}`);
    const reasons = report.dropped.map((dropped) => dropped.reason);
    const commands = [...new Set(report.dropped.flatMap((dropped) => dropped.commands))];
    if (reasons.length > 0) {
      console.log(`    dropped ${reasons.length} (${[...new Set(reasons)].join(', ')})`);
      console.log(
        `    commands: ${commands.slice(0, 12).join(', ')}${commands.length > 12 ? ', ...' : ''}`,
      );
    }
  }

  const bytes = Object.values(files).reduce((sum, content) => sum + Buffer.byteLength(content), 0);
  console.log(`Generated ${Object.keys(files).length} files, ${(bytes / 1024).toFixed(1)} KiB`);

  console.log('i18n keys');
  for (const [group, keys] of Object.entries(result.i18nKeys)) {
    console.log(`  ${group} (${keys.length}):`);
    keys.forEach((key) => console.log(`    ${key}`));
  }
};

const main = async () => {
  const outDirArg = process.argv.indexOf('--out');
  const outDir = outDirArg > -1 ? path.resolve(process.argv[outDirArg + 1] ?? '') : GENERATED_DIR;
  const checkOnly = process.argv.includes('--check');

  const result = buildAll(loadRawData(ECU_DATA_DIR));
  const files = await formatAll(result.files);

  if (checkOnly) {
    const drift = findDrift(GENERATED_DIR, files);
    if (drift.length > 0) {
      console.error(`Generated data is out of date:\n${drift.join('\n')}\nRun npm run gen:data`);
      process.exit(1);
    }
    console.log('Generated data is up to date');
    return;
  }

  writeAll(outDir, files);
  printSummary(result, files);
};

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
