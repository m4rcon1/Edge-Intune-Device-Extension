import type { DeviceListAdapter } from "./device-list-adapter";

export class MockDeviceListAdapter implements DeviceListAdapter {
  public readonly buttonClassName = "";
  readonly #observer: MutationObserver;
  #onChange: (() => void) | null = null;
  #changeScheduled = false;

  public constructor(private readonly root: HTMLElement) {
    this.#observer = new MutationObserver(() => this.scheduleChange());
  }

  public start(onChange: () => void): void {
    this.#onChange = onChange;
    this.#observer.observe(this.root, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    onChange();
  }

  public stop(): void {
    this.#observer.disconnect();
    this.#onChange = null;
    this.#changeScheduled = false;
  }

  public getRoot(): HTMLElement {
    return this.root;
  }

  public findDeviceNameElements(): readonly HTMLElement[] {
    return Array.from(this.root.querySelectorAll<HTMLElement>(".device-name"));
  }

  public getDeviceName(nameElement: HTMLElement): string {
    return nameElement.textContent ?? "";
  }

  public insertInformationButton(nameElement: HTMLElement, button: HTMLButtonElement): void {
    nameElement.before(button);
  }

  private scheduleChange(): void {
    if (this.#changeScheduled) {
      return;
    }

    this.#changeScheduled = true;
    queueMicrotask(() => {
      this.#changeScheduled = false;
      this.#onChange?.();
    });
  }
}
