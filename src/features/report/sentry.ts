import * as Sentry from '@sentry/react-native';

import { scrubBreadcrumb, scrubEvent, scrubText } from './scrub';

const FALLBACK_MESSAGE = 'No message provided';
const ATTACHMENT_FILENAME = 'diagnostic-log.txt';

export class SentryNotConfiguredError extends Error {
  constructor() {
    super('Sentry DSN is not configured');
  }
}

const getDsn = () => process.env.EXPO_PUBLIC_SENTRY_DSN?.trim() || undefined;

export const isSentryConfigured = () => getDsn() !== undefined;

export const initSentry = () => {
  const dsn = getDsn();
  if (!dsn) return;

  Sentry.init({
    dsn,
    enabled: true,
    sendDefaultPii: false,
    beforeSend: scrubEvent,
    beforeBreadcrumb: scrubBreadcrumb,
  });
};

export interface ReportInput {
  message: string;
  logText: string;
  tags: Record<string, string>;
}

export const submitReport = async ({ message, logText, tags }: ReportInput) => {
  if (!isSentryConfigured()) throw new SentryNotConfiguredError();

  const trimmed = message.trim();
  const attachment = {
    filename: ATTACHMENT_FILENAME,
    data: scrubText(logText),
    contentType: 'text/plain',
  };

  Sentry.captureFeedback(
    { message: trimmed || FALLBACK_MESSAGE, tags },
    { attachments: [attachment] },
  );

  const flushed = await Sentry.flush();
  if (!flushed) throw new Error('Report could not be delivered');
};
