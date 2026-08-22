export interface DeviceListAdapter {
  readonly buttonClassName: string;

  start(onChange: () => void): void;
  stop(): void;
  getRoot(): HTMLElement | null;
  findDeviceNameElements(): readonly HTMLElement[];
  getDeviceName(nameElement: HTMLElement): string;
  insertInformationButton(nameElement: HTMLElement, button: HTMLButtonElement): void;
}
