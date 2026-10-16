import { useSettingsStore } from '@/stores/settings';

import type { Breadcrumb, ErrorEvent } from '@sentry/react-native';

const VIN_PATTERN = /\b[A-HJ-NPR-Z0-9]{17}\b/g;
const IPV4_PATTERN = /\b(?:\d{1,3}\.){3}\d{1,3}\b/g;

const VIN_PLACEHOLDER = '[VIN omitted]';
const HOST_PLACEHOLDER = '[host omitted]';

const configuredHosts = () => {
  const { enetHost, lastEnetHost, thorHost, elmWifiHost } = useSettingsStore.getState();
  return [enetHost, lastEnetHost, thorHost, elmWifiHost ?? '']
    .map((host) => host.trim())
    .filter(Boolean);
};

export const scrubText = (text: string): string =>
  configuredHosts()
    .reduce((result, host) => result.replaceAll(host, HOST_PLACEHOLDER), text)
    .replace(VIN_PATTERN, VIN_PLACEHOLDER)
    .replace(IPV4_PATTERN, HOST_PLACEHOLDER);

const scrubOptional = (text: string | undefined) => (text === undefined ? text : scrubText(text));

export const scrubBreadcrumb = (breadcrumb: Breadcrumb): Breadcrumb => ({
  ...breadcrumb,
  message: scrubOptional(breadcrumb.message),
});

export const scrubEvent = (event: ErrorEvent): ErrorEvent => ({
  ...event,
  message: scrubOptional(event.message),
  exception: event.exception && {
    ...event.exception,
    values: event.exception.values?.map((value) => ({
      ...value,
      value: scrubOptional(value.value),
    })),
  },
  breadcrumbs: event.breadcrumbs?.map(scrubBreadcrumb),
});
