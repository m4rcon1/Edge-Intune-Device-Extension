export interface ParsedDeviceName {
  deviceName: string;
  serialNumber: string;
}

const LENOVO_DEVICE_NAME = /^(?:NB|D)-([A-Z0-9]+)$/i;
const LENOVO_SERIAL_NUMBER = /^[A-Z0-9]+$/i;

export function parseDeviceName(value: string): ParsedDeviceName | null {
  const deviceName = value.trim();
  const match = LENOVO_DEVICE_NAME.exec(deviceName);
  const serialNumber = match?.[1];

  if (serialNumber === undefined) {
    return null;
  }

  return {
    deviceName,
    serialNumber: serialNumber.toUpperCase(),
  };
}

export function isSupportedDeviceName(value: string): boolean {
  return parseDeviceName(value) !== null;
}

export function normalizeSerialNumber(value: string): string | null {
  const serialNumber = value.trim();
  return LENOVO_SERIAL_NUMBER.test(serialNumber) ? serialNumber.toUpperCase() : null;
}
