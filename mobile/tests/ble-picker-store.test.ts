import test from 'node:test';
import assert from 'node:assert/strict';
import { getPickerRequest, requestDeviceChoice, settleDeviceChoice, subscribePicker } from '../src/ble-picker-store';

const candidates = [{ id: 'a', name: 'iCar', rssi: -50, serviceUUIDs: null }];

test('request is published to subscribers and resolves with the chosen id', async () => {
  let notifications = 0;
  const unsubscribe = subscribePicker(() => notifications++);
  const choice = requestDeviceChoice(candidates);
  assert.equal(getPickerRequest()?.candidates, candidates);
  settleDeviceChoice('a');
  assert.equal(await choice, 'a');
  assert.equal(getPickerRequest(), null);
  assert.equal(notifications, 2);
  unsubscribe();
});

test('cancel resolves null and a new request supersedes a pending one', async () => {
  const first = requestDeviceChoice(candidates);
  const second = requestDeviceChoice(candidates);
  assert.equal(await first, null);
  settleDeviceChoice(null);
  assert.equal(await second, null);
  settleDeviceChoice('x');
});
