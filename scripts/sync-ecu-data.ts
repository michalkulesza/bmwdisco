import fs from 'node:fs';
import path from 'node:path';

import { ECU_DATA_DIR, MODULE_SGBDS, PACKS } from './gen-data/paths';
import { isFSeriesLabel } from './gen-data/vehicles';

const sourceDirectory = process.env.ECU_SOURCE_DIR;
if (!sourceDirectory) {
  throw new Error('Set ECU_SOURCE_DIR to the directory containing ECU source JSON files.');
}
const SOURCE_DIR = path.resolve(sourceDirectory);

const copyFile = (name: string) => {
  fs.copyFileSync(path.join(SOURCE_DIR, name), path.join(ECU_DATA_DIR, name));
};

const copyModules = () => {
  for (const sgbd of MODULE_SGBDS) {
    copyFile(`${sgbd}.json`);
    copyFile(`${sgbd}.uds.json`);
  }
};

const writeFilteredChassisInfo = () => {
  const rows: { series: string }[] = JSON.parse(
    fs.readFileSync(path.join(SOURCE_DIR, 'chassis_info.json'), 'utf8'),
  );
  const fSeriesRows = rows.filter((row) => isFSeriesLabel(row.series));

  fs.writeFileSync(
    path.join(ECU_DATA_DIR, 'chassis_info.json'),
    `${JSON.stringify(fSeriesRows, null, 2)}\n`,
  );
  console.log(`chassis_info.json: ${fSeriesRows.length}/${rows.length} rows kept`);
};

const main = () => {
  fs.mkdirSync(ECU_DATA_DIR, { recursive: true });

  copyModules();
  PACKS.forEach((pack) => copyFile(`${pack}.json`));
  copyFile('ecu_modules.json');
  writeFilteredChassisInfo();
};

main();
