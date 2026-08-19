export interface ParsedDeviceName {
  deviceName: string;
  serialNumber: string;
}

const LENOVO_NOTEBOOK_NAME = /^NB-([A-Z0-9]+)$/i;

export function parseDeviceName(value: string): ParsedDeviceName | null {
  const deviceName = value.trim();
  const match = LENOVO_NOTEBOOK_NAME.exec(deviceName);
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
