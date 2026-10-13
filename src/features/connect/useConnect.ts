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

export const useReconnect = () => {
  const settings = useSettingsStore(useShallow(selectAdapterSettings));
  const sessionConfig = useSessionSelector((snapshot) => snapshot.context.config);
  const { connect, disconnect } = useSessionActions();

  return useCallback(() => {
    const config = sessionConfig ?? toAdapterConfig(settings);
    if (!config) return;

    disconnect();
    connect(config);
  }, [connect, disconnect, sessionConfig, settings]);
};
