import { parseDeviceName } from "../domain/device-name";
import type { DeviceListAdapter } from "./device-list-adapter";
interface DevicePopover {
  toggle(anchor: HTMLButtonElement, device: { deviceName: string; serialNumber: string }): void;
  closeIfAnchoredWithin(container: Element): void;
}

interface Decoration {
  button: HTMLButtonElement;
  serialNumber: string;
}

export class DeviceDecorator {
  readonly #decorations = new Map<HTMLElement, Decoration>();
  #currentRoot: HTMLElement | null = null;
  #started = false;

  public constructor(
    private readonly adapter: DeviceListAdapter,
    private readonly popover: DevicePopover,
  ) {}

  public start(): void {
    if (this.#started) {
      return;
    }

    this.#started = true;
    this.adapter.start(this.handleAdapterChange);
  }

  public stop(): void {
    if (!this.#started) {
      return;
    }

    this.adapter.stop();
    this.#started = false;
    this.removeAllDecorations();
    this.#currentRoot = null;
  }

  public scan(): void {
    const nameElements = new Set(this.adapter.findDeviceNameElements());
    for (const [nameElement, decoration] of this.#decorations) {
      if (!nameElements.has(nameElement) || !nameElement.isConnected) {
        this.popover.closeIfAnchoredWithin(decoration.button);
        decoration.button.remove();
        this.#decorations.delete(nameElement);
      }
    }

    for (const nameElement of nameElements) {
      this.decorate(nameElement);
    }
  }

  private decorate(nameElement: HTMLElement): void {
    const parsedDevice = parseDeviceName(this.adapter.getDeviceName(nameElement));
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
    button.className = ["warranty-info-button", this.adapter.buttonClassName]
      .filter(Boolean)
      .join(" ");
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
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      this.popover.toggle(button, parsedDevice);
    });

    this.adapter.insertInformationButton(nameElement, button);
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

  private removeAllDecorations(): void {
    for (const decoration of this.#decorations.values()) {
      this.popover.closeIfAnchoredWithin(decoration.button);
      decoration.button.remove();
    }
    this.#decorations.clear();
  }

  private readonly handleAdapterChange = (): void => {
    const nextRoot = this.adapter.getRoot();
    if (this.#currentRoot !== null && this.#currentRoot !== nextRoot) {
      this.popover.closeIfAnchoredWithin(this.#currentRoot);
    }
    this.#currentRoot = nextRoot;
    this.scan();
  };
}
