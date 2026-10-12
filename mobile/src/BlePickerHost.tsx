import { useSyncExternalStore } from 'react';
import { AlertDialog, Button, Column, Host, Text } from '@expo/ui/jetpack-compose';
import { getPickerRequest, settleDeviceChoice, subscribePicker } from './ble-picker-store';
import { candidateLabel } from './protocol/elm';

const handleCancel = () => settleDeviceChoice(null);

const BlePickerHost = () => {
  const request = useSyncExternalStore(subscribePicker, getPickerRequest);
  if (!request) return null;

  return <Host matchContents>
    <AlertDialog onDismissRequest={handleCancel}>
      <AlertDialog.Title><Text>Choose Bluetooth adapter</Text></AlertDialog.Title>
      <AlertDialog.Text>
        <Column>
          {request.candidates.map(candidate => <Button key={candidate.id} onClick={() => settleDeviceChoice(candidate.id)}>
            <Text>{candidateLabel(candidate)}</Text>
          </Button>)}
        </Column>
      </AlertDialog.Text>
      <AlertDialog.ConfirmButton>
        <Button onClick={handleCancel}><Text>Cancel</Text></Button>
      </AlertDialog.ConfirmButton>
    </AlertDialog>
  </Host>;
};

export default BlePickerHost;
