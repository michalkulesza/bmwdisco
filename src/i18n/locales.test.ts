import i18nKeys from '@/data/generated/i18n-keys.json';

import en from './en.json';
import pl from './pl.json';

type Tree = { [key: string]: string | Tree };

const flattenKeys = (tree: Tree, prefix = ''): string[] =>
  Object.entries(tree).flatMap(([key, value]) =>
    typeof value === 'string' ? [`${prefix}${key}`] : flattenKeys(value, `${prefix}${key}.`),
  );

describe('locale files', () => {
  it('define the same keys in en and pl', () => {
    const enKeys = flattenKeys(en);
    const plKeys = flattenKeys(pl);

    const missingInPl = enKeys.filter((key) => !plKeys.includes(key));
    const missingInEn = plKeys.filter((key) => !enKeys.includes(key));

    expect({ missingInPl, missingInEn }).toEqual({ missingInPl: [], missingInEn: [] });
  });

  it('translate every key referenced by the generated ECU data', () => {
    const enKeys = flattenKeys(en);
    const missing = Object.values(i18nKeys)
      .flat()
      .filter((key) => !enKeys.includes(key));

    expect(missing).toEqual([]);
  });
});
