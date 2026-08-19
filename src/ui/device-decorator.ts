import { parseDeviceName } from "../domain/device-name";
interface DevicePopover {
  toggle(anchor: HTMLButtonElement, device: { deviceName: string; serialNumber: string }): void;
  closeIfAnchoredWithin(container: Element): void;
}

interface Decoration {
  button: HTMLButtonElement;
  serialNumber: string;
}

export class DeviceDecorator {
  readonly #decorations = new WeakMap<HTMLElement, Decoration>();
  readonly #observer: MutationObserver;

  public constructor(
    private readonly root: HTMLElement,
    private readonly popover: DevicePopover,
  ) {
    this.#observer = new MutationObserver(() => this.scan());
  }

  public start(): void {
    this.scan();
    this.#observer.observe(this.root, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  }

  public stop(): void {
    this.#observer.disconnect();
  }

  public scan(): void {
    for (const nameElement of this.root.querySelectorAll<HTMLElement>(".device-name")) {
      this.decorate(nameElement);
    }
  }

  private decorate(nameElement: HTMLElement): void {
    const parsedDevice = parseDeviceName(nameElement.textContent ?? "");
    const currentDecoration = this.#decorations.get(nameElement);

    if (parsedDevice === null) {
      if (currentDecoration !== undefined) {
        this.popover.closeIfAnchoredWithin(currentDecoration.button);
        currentDecoration.button.remove();
        this.#decorations.delete(nameElement);
      }
      this.removeOrphanedButtons(nameElement);
      return;
    }

    if (
      currentDecoration !== undefined &&
      currentDecoration.serialNumber === parsedDevice.serialNumber &&
      currentDecoration.button.isConnected
    ) {
      return;
    }

    if (currentDecoration !== undefined) {
      this.popover.closeIfAnchoredWithin(currentDecoration.button);
      currentDecoration.button.remove();
    }
    this.removeOrphanedButtons(nameElement);

    const button = document.createElement("button");
    button.type = "button";
    button.className = "warranty-info-button";
    button.dataset.warrantyOwned = "true";
    button.dataset.serialNumber = parsedDevice.serialNumber;
    button.setAttribute(
      "aria-label",
      `Garantieinformationen für ${parsedDevice.deviceName} anzeigen`,
    );
    button.setAttribute("aria-haspopup", "dialog");
    button.setAttribute("aria-controls", "warranty-popover");
    button.setAttribute("aria-expanded", "false");
    button.textContent = "i";
    button.addEventListener("click", () => this.popover.toggle(button, parsedDevice));

    nameElement.before(button);
    this.#decorations.set(nameElement, {
      button,
      serialNumber: parsedDevice.serialNumber,
    });
  }

  private removeOrphanedButtons(nameElement: HTMLElement): void {
    const container = nameElement.parentElement;
    if (container === null) {
      return;
    }

    for (const button of container.querySelectorAll<HTMLButtonElement>(
      ':scope > .warranty-info-button[data-warranty-owned="true"]',
    )) {
      button.remove();
    }
  }
}
