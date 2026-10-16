export interface BleAdapterProfile {
  id: string;
  label: string;
  serviceUuids: readonly string[];
  writeUuids: readonly string[];
  notifyUuids: readonly string[];
}

export interface BleCharacteristicInfo {
  uuid: string;
  writable: boolean;
  notifiable: boolean;
}

export interface BleServiceInfo {
  uuid: string;
  characteristics: BleCharacteristicInfo[];
}

export interface BleSelection {
  profile: BleAdapterProfile;
  serviceUuid: string;
  writeUuid: string;
  notifyUuid: string;
}

export interface BleAdvert {
  id: string;
  name: string | null;
  rssi: number | null;
  serviceUuids: string[];
}

const VGATE_SERIAL = 'bef8d6c9-9c21-4c9e-b632-bd58c1009f9f';

export const BLE_ADAPTER_PROFILES: readonly BleAdapterProfile[] = [
  {
    id: 'vgate-icar',
    label: 'Vgate iCar',
    serviceUuids: ['18f0', 'ffe0', 'e7810a71-73ae-499d-8c15-faa9aef0c3f2', VGATE_SERIAL],
    writeUuids: [VGATE_SERIAL],
    notifyUuids: [VGATE_SERIAL, '2af0'],
  },
  {
    id: 'elm-fff0',
    label: 'BLE ELM327 (FFF0)',
    serviceUuids: ['fff0'],
    writeUuids: ['fff2'],
    notifyUuids: ['fff1'],
  },
  {
    id: 'elm-ffe0',
    label: 'BLE ELM327 (FFE0)',
    serviceUuids: ['ffe0'],
    writeUuids: ['ffe1'],
    notifyUuids: ['ffe1'],
  },
];

const BASE_UUID_SUFFIX = '-0000-1000-8000-00805f9b34fb';
const SHORT_UUID_PATTERN = /^[0-9a-f]{4}$/;
const BASE_UUID_PATTERN = /^0000([0-9a-f]{4})-0000-1000-8000-00805f9b34fb$/;
export const MIN_WRITE_SIZE = 20;
const ATT_HEADER = 3;

export const normalizeUuid = (uuid: string): string => {
  const lower = uuid.toLowerCase();

  return BASE_UUID_PATTERN.exec(lower)?.[1] ?? lower;
};

export const toFullUuid = (uuid: string): string => {
  const normalized = normalizeUuid(uuid);

  return SHORT_UUID_PATTERN.test(normalized) ? `0000${normalized}${BASE_UUID_SUFFIX}` : normalized;
};

export const scanServiceUuids = (profiles = BLE_ADAPTER_PROFILES): string[] => [
  ...new Set(profiles.flatMap((profile) => profile.serviceUuids.map(toFullUuid))),
];

export const isKnownAdapterAdvert = (
  advert: Pick<BleAdvert, 'serviceUuids'>,
  profiles = BLE_ADAPTER_PROFILES,
): boolean => {
  const advertised = advert.serviceUuids.map(normalizeUuid);

  return profiles.some((profile) =>
    profile.serviceUuids.some((uuid) => advertised.includes(normalizeUuid(uuid))),
  );
};

export const selectProfile = (
  services: BleServiceInfo[],
  profiles = BLE_ADAPTER_PROFILES,
): BleSelection | undefined => {
  for (const profile of profiles) {
    for (const service of services) {
      if (
        !profile.serviceUuids.some((uuid) => normalizeUuid(uuid) === normalizeUuid(service.uuid))
      ) {
        continue;
      }
      const found = service.characteristics.map((item) => ({
        ...item,
        uuid: normalizeUuid(item.uuid),
      }));
      const writeUuid = profile.writeUuids.find((uuid) =>
        found.some((item) => item.uuid === uuid && item.writable),
      );
      const notifyUuid = profile.notifyUuids.find((uuid) =>
        found.some((item) => item.uuid === uuid && item.notifiable),
      );

      if (writeUuid && notifyUuid) {
        return { profile, serviceUuid: normalizeUuid(service.uuid), writeUuid, notifyUuid };
      }
    }
  }

  return undefined;
};

export const writeSizeForMtu = (mtu: number): number => Math.max(MIN_WRITE_SIZE, mtu - ATT_HEADER);

export const chunkBytes = (data: Uint8Array, size: number): Uint8Array[] => {
  const chunks: Uint8Array[] = [];
  for (let offset = 0; offset < data.length; offset += size) {
    chunks.push(data.slice(offset, offset + size));
  }

  return chunks;
};

export const writeChunked = async (
  data: Uint8Array,
  size: number,
  writeChunk: (chunk: Uint8Array) => Promise<void>,
): Promise<void> => {
  for (const chunk of chunkBytes(data, size)) await writeChunk(chunk);
};
