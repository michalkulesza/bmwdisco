import { Platform, Text } from 'react-native';

import { headerLeftOptions, headerRightOptions } from '../headerItems';

const element = <Text>x</Text>;

const setPlatform = (os: 'ios' | 'android') => {
  jest.replaceProperty(Platform, 'OS', os);
};

afterEach(() => jest.restoreAllMocks());

describe('header options', () => {
  it('uses unstable item lists on iOS', () => {
    setPlatform('ios');

    const right = headerRightOptions(element);
    const left = headerLeftOptions(element);

    expect(right.unstable_headerRightItems?.({} as never)).toEqual([
      { type: 'custom', element, hidesSharedBackground: true },
    ]);
    expect(left.unstable_headerLeftItems).toBeDefined();
    expect(right.headerRight).toBeUndefined();
  });

  it('uses render functions on Android', () => {
    setPlatform('android');

    const right = headerRightOptions(element);
    const left = headerLeftOptions(element);

    expect(right.headerRight?.({} as never)).toBe(element);
    expect(left.headerLeft?.({} as never)).toBe(element);
    expect(right.unstable_headerRightItems).toBeUndefined();
  });
});
