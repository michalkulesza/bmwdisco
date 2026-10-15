import { router } from 'expo-router';
import { useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';

import { useSessionActions, useSessionSelector } from '@/session';
import { selectAdapterSettings, useSettingsStore } from '@/stores/settings';

import { toAdapterConfig } from './helpers';

export const useConnect = () => {
  const settings = useSettingsStore(useShallow(selectAdapterSettings));
  const { connect } = useSessionActions();

  return useCallback(() => {
    const config = toAdapterConfig(settings);
    if (config) {
      connect(config);

      return;
    }

    const needsDevice = settings.adapter === 'vgate' && settings.icarDevice === null;
    router.push(needsDevice ? '/settings/ble-devices' : '/settings/cable');
  }, [connect, settings]);
};

export const useConnectNow = () => {
  const settings = useSettingsStore(useShallow(selectAdapterSettings));
  const { connect } = useSessionActions();
  const config = toAdapterConfig(settings);

  const connectNow = useCallback(() => {
    if (config) connect(config);
  }, [connect, config]);

  return { canConnect: config !== undefined, connectNow };
};

export const useReconnect = () => {
  const settings = useSettingsStore(useShallow(selectAdapterSettings));
  const sessionConfig = useSessionSelector((snapshot) => snapshot.context.config);
  const { connect } = useSessionActions();

  return useCallback(() => {
    const config = sessionConfig ?? toAdapterConfig(settings);
    if (!config) return;

    connect(config);
  }, [connect, sessionConfig, settings]);
};
