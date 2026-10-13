import { act, renderHook } from '@testing-library/react-native';

import '@/i18n';
import { PresetImportError } from '@/domain';
import { SEED_PRESETS, usePresetsStore } from '@/stores/presets';
import { toastShow } from '@/test-utils/mock-ui';

import { pickPresets, sharePresets } from './transfer';
import { usePresetTransfer } from './usePresetTransfer';

jest.mock('@/ui/Toast', () => jest.requireActual('@/test-utils/mock-ui').toastModule);
jest.mock('./transfer', () => ({
  ...jest.requireActual('./transfer'),
  pickPresets: jest.fn(),
  sharePresets: jest.fn(),
}));

const pick = pickPresets as jest.Mock;
const share = sharePresets as jest.Mock;

describe('usePresetTransfer', () => {
  beforeEach(() => {
    toastShow.mockClear();
    pick.mockReset();
    share.mockReset();
    usePresetsStore.setState({ presets: [...SEED_PRESETS] });
  });

  it('imports presets from a file', async () => {
    pick.mockResolvedValue([{ ...SEED_PRESETS[0]!, id: 'imported' }]);
    const { result } = await renderHook(() => usePresetTransfer());

    await act(async () => result.current.importFromFile());

    expect(usePresetsStore.getState().presets.map((preset) => preset.id)).toContain('imported');
    expect(toastShow).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Imported presets: 1', tone: 'success' }),
    );
  });

  it('does nothing when the picker is cancelled', async () => {
    pick.mockResolvedValue(undefined);
    const { result } = await renderHook(() => usePresetTransfer());

    await act(async () => result.current.importFromFile());

    expect(toastShow).not.toHaveBeenCalled();
  });

  it('shows an error toast for an invalid file', async () => {
    pick.mockRejectedValue(new PresetImportError('invalidJson'));
    const { result } = await renderHook(() => usePresetTransfer());

    await act(async () => result.current.importFromFile());

    expect(toastShow).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Could not import the file',
        description: 'The file is not valid JSON',
        tone: 'error',
      }),
    );
    expect(usePresetsStore.getState().presets).toHaveLength(SEED_PRESETS.length);
  });

  it('exports a preset and reports share failures', async () => {
    share
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false)
      .mockRejectedValueOnce(new Error());
    const { result } = await renderHook(() => usePresetTransfer());

    await act(async () => result.current.exportPreset(SEED_PRESETS[0]!));
    expect(toastShow).not.toHaveBeenCalled();

    await act(async () => result.current.exportPreset(SEED_PRESETS[0]!));
    await act(async () => result.current.exportPreset(SEED_PRESETS[0]!));

    expect(toastShow).toHaveBeenCalledTimes(2);
    expect(share).toHaveBeenCalledWith([SEED_PRESETS[0]], 'bimmerdisco-double-flash.json');
  });
});
