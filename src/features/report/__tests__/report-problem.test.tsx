import * as Sentry from '@sentry/react-native';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import ReportButton from '@/features/home/HomeScreen/ReportButton';
import { renderWithSession } from '@/test-utils/session-ui';

import ReportProblemModal from '../ReportProblemModal';
import { useReportStore } from '../store';

const captureFeedback = jest.mocked(Sentry.captureFeedback);
const flush = jest.mocked(Sentry.flush);

const Harness = () => (
  <>
    <ReportButton />
    <ReportProblemModal />
  </>
);

const openModal = async () => {
  await renderWithSession(<Harness />);
  await fireEvent.press(screen.getByRole('button', { name: 'Report a problem' }));
};

describe('Report a problem', () => {
  beforeEach(() => {
    process.env.EXPO_PUBLIC_SENTRY_DSN = 'https://key@o0.ingest.sentry.io/1';
    captureFeedback.mockClear();
    flush.mockReset();
    flush.mockResolvedValue(true);
    useReportStore.setState({ open: false });
  });

  afterAll(() => {
    delete process.env.EXPO_PUBLIC_SENTRY_DSN;
  });

  it('opens the dialog from the header button', async () => {
    await renderWithSession(<Harness />);
    expect(screen.queryByText('Tell us what went wrong', { exact: false })).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: 'Report a problem' }));

    expect(screen.getByText('Tell us what went wrong', { exact: false })).toBeTruthy();
    expect(screen.getByPlaceholderText('Message (optional)')).toBeTruthy();
  });

  it('sends the message with the diagnostic log and shows the sent state', async () => {
    await openModal();
    await fireEvent.changeText(screen.getByLabelText('Message'), 'Lights stuck on');

    await fireEvent.press(screen.getByRole('button', { name: 'Send' }));

    await waitFor(() => expect(screen.getByText('Report sent')).toBeTruthy());
    expect(captureFeedback).toHaveBeenCalledWith(
      {
        message: 'Lights stuck on',
        tags: { adapter: 'none', chassis: 'unknown', phase: expect.any(String) },
      },
      {
        attachments: [
          expect.objectContaining({
            filename: 'diagnostic-log.txt',
            data: expect.stringContaining('BimmerDisco diagnostic log'),
          }),
        ],
      },
    );

    await fireEvent.press(screen.getByRole('button', { name: 'Done' }));

    expect(useReportStore.getState().open).toBe(false);
  });

  it('sends a fallback message when the field is empty', async () => {
    await openModal();

    await fireEvent.press(screen.getByRole('button', { name: 'Send' }));

    await waitFor(() => expect(captureFeedback).toHaveBeenCalled());
    expect(captureFeedback.mock.calls[0]?.[0].message).toBe('No message provided');
  });

  it('shows an error and keeps the message when delivery fails', async () => {
    flush.mockResolvedValue(false);
    await openModal();
    await fireEvent.changeText(screen.getByLabelText('Message'), 'Lights stuck on');

    await fireEvent.press(screen.getByRole('button', { name: 'Send' }));

    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
    expect(screen.getByText(/Could not send the report/)).toBeTruthy();
    expect(screen.getByDisplayValue('Lights stuck on')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Send' })).toBeTruthy();
  });

  it('shows the not-configured error without a DSN', async () => {
    delete process.env.EXPO_PUBLIC_SENTRY_DSN;
    await openModal();

    await fireEvent.press(screen.getByRole('button', { name: 'Send' }));

    await waitFor(() => expect(screen.getByText(/Reporting is not set up/)).toBeTruthy());
    expect(captureFeedback).not.toHaveBeenCalled();
  });

  it('closes without sending', async () => {
    await openModal();

    await fireEvent.press(screen.getAllByRole('button', { name: 'Close' })[0]!);

    expect(useReportStore.getState().open).toBe(false);
    expect(captureFeedback).not.toHaveBeenCalled();
  });
});
