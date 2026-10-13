import { useSessionActions, useSessionPhase, useSessionSelector } from '@/session';

import ConnectErrorView from './ConnectErrorView';
import ConnectingView from './ConnectingView';
import { isOnlinePhase, toErrorReason } from './helpers';
import NotConnectedView from './NotConnectedView';
import { useConnect } from './useConnect';

const ConnectScreen = () => {
  const phase = useSessionPhase();
  const reason = useSessionSelector((snapshot) => snapshot.context.lastError?.reason);
  const { disconnect } = useSessionActions();
  const connect = useConnect();

  if (phase === 'error') {
    return (
      <ConnectErrorView reason={toErrorReason(reason)} onRetry={connect} onBack={disconnect} />
    );
  }
  if (phase === 'connecting' || phase === 'identifying' || isOnlinePhase(phase)) {
    return <ConnectingView phase={phase} />;
  }

  return <NotConnectedView />;
};

export default ConnectScreen;
