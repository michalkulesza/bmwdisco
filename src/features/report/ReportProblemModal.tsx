import { useCallback, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, ScrollView, View } from 'react-native';

import ReportForm from './ReportForm';
import ReportSent from './ReportSent';
import { useReportStore } from './store';
import { useSendReport } from './useSendReport';

const KEYBOARD_BEHAVIOR = Platform.OS === 'ios' ? 'padding' : undefined;

const ReportProblemModal = () => {
  const open = useReportStore((state) => state.open);
  const closeReport = useReportStore((state) => state.closeReport);
  const { status, send, reset } = useSendReport();
  const [message, setMessage] = useState('');

  const handleSend = useCallback(() => send(message), [send, message]);

  const handleClose = useCallback(() => {
    closeReport();
    reset();
  }, [closeReport, reset]);

  const handleDone = useCallback(() => {
    setMessage('');
    handleClose();
  }, [handleClose]);

  return (
    <Modal
      visible={open}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView behavior={KEYBOARD_BEHAVIOR} className="flex-1 bg-overlay">
        <ScrollView
          accessibilityViewIsModal
          keyboardShouldPersistTaps="handled"
          contentContainerClassName="px-4 pb-6 pt-[150px]"
        >
          <View className="gap-4 rounded-tile-lg border border-card-border bg-card p-5">
            {status === 'sent' ? (
              <ReportSent onDone={handleDone} />
            ) : (
              <ReportForm
                message={message}
                status={status}
                onChangeMessage={setMessage}
                onSend={handleSend}
                onClose={handleClose}
              />
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
};

export default ReportProblemModal;
