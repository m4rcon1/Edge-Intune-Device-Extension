import { normalizeWarrantyError, type WarrantyCoverage } from "../domain/warranty";
import type { WarrantyLookup, WarrantyLookupResult } from "../services/warranty-service";
import { formatDateOnly, formatDateTime } from "./date-format";

interface DeviceReference {
  deviceName: string;
  serialNumber: string;
}

export class PopoverController {
  readonly #element: HTMLDivElement;
  #anchor: HTMLButtonElement | null = null;
  #device: DeviceReference | null = null;
  #requestSequence = 0;
  #abortController: AbortController | null = null;

  public constructor(private readonly warrantyLookup: WarrantyLookup) {
    this.#element = document.createElement("div");
    this.#element.id = "warranty-popover";
    this.#element.className = "warranty-popover";
    this.#element.hidden = true;
    this.#element.setAttribute("role", "dialog");
    this.#element.setAttribute("aria-label", "Garantieinformationen");
    document.body.append(this.#element);

    document.addEventListener("pointerdown", this.handleOutsidePointerDown, true);
    document.addEventListener("keydown", this.handleKeyDown);
    window.addEventListener("resize", this.reposition);
    window.addEventListener("scroll", this.reposition, true);
  }

  public toggle(anchor: HTMLButtonElement, device: DeviceReference): void {
    if (this.#anchor === anchor && !this.#element.hidden) {
      this.close();
      return;
    }

    this.open(anchor, device);
  }

  public close(returnFocus = false): void {
    const previousAnchor = this.#anchor;
    this.#abortController?.abort();
    this.#abortController = null;
    this.#requestSequence += 1;
    this.#element.hidden = true;
    this.#element.replaceChildren();
    this.#anchor?.setAttribute("aria-expanded", "false");
    this.#anchor = null;
    this.#device = null;

    if (returnFocus) {
      previousAnchor?.focus();
    }
  }

  public closeIfAnchoredWithin(container: Element): void {
    if (this.#anchor !== null && container.contains(this.#anchor)) {
      this.close();
    }
  }

  public destroy(): void {
    this.close();
    document.removeEventListener("pointerdown", this.handleOutsidePointerDown, true);
    document.removeEventListener("keydown", this.handleKeyDown);
    window.removeEventListener("resize", this.reposition);
    window.removeEventListener("scroll", this.reposition, true);
    this.#element.remove();
  }

  private open(anchor: HTMLButtonElement, device: DeviceReference): void {
    this.close();
    this.#anchor = anchor;
    this.#device = device;
    anchor.setAttribute("aria-expanded", "true");
    this.#element.hidden = false;
    this.renderLoading(device);
    this.reposition();
    void this.loadWarranty(false);
  }

  private async loadWarranty(forceRefresh: boolean): Promise<void> {
    const device = this.#device;
    if (device === null) {
      return;
    }

    this.#abortController?.abort();
    const abortController = new AbortController();
    this.#abortController = abortController;
    const sequence = ++this.#requestSequence;
    this.renderLoading(device);

    try {
      const result = await this.warrantyLookup.getWarranty(device.serialNumber, {
        forceRefresh,
        signal: abortController.signal,
      });
      if (sequence === this.#requestSequence) {
        this.renderResult(device, result);
        this.reposition();
      }
    } catch (error) {
      if (abortController.signal.aborted || sequence !== this.#requestSequence) {
        return;
      }

      this.renderError(device, error);
      this.reposition();
    }
  }

  private renderLoading(device: DeviceReference): void {
    const content = this.createFrame(device);
    const loading = document.createElement("div");
    loading.className = "warranty-loading";
    loading.setAttribute("role", "status");

    const spinner = document.createElement("span");
    spinner.className = "spinner";
    spinner.setAttribute("aria-hidden", "true");
    loading.append(spinner, document.createTextNode("Garantieinformationen werden geladen …"));
    content.append(loading);
  }

  private renderResult(device: DeviceReference, result: WarrantyLookupResult): void {
    const content = this.createFrame(device);
    const coverages = document.createElement("div");
    coverages.className = "coverage-list";

    for (const coverage of result.warranty.coverages) {
      coverages.append(this.createCoverage(coverage));
    }

    const metadata = document.createElement("p");
    metadata.className = "warranty-metadata";
    metadata.textContent = `${result.fromCache ? "Aus lokalem Cache" : "Simuliert abgefragt"} · ${formatDateTime(result.cachedAt)}`;

    const refreshButton = document.createElement("button");
    refreshButton.type = "button";
    refreshButton.className = "refresh-button";
    refreshButton.textContent = "Neu laden";
    refreshButton.addEventListener("click", () => void this.loadWarranty(true));

    content.append(coverages, metadata, refreshButton);
  }

  private renderError(device: DeviceReference, error: unknown): void {
    const content = this.createFrame(device);
    const warrantyError = normalizeWarrantyError(error);
    const errorBox = document.createElement("div");
    errorBox.className = "warranty-error";
    errorBox.setAttribute("role", "alert");

    const title = document.createElement("strong");
    title.textContent = errorTitle(warrantyError.code);
    const message = document.createElement("p");
    message.textContent = errorDescription(warrantyError.code);
    errorBox.append(title, message);

    const retryButton = document.createElement("button");
    retryButton.type = "button";
    retryButton.className = "refresh-button";
    retryButton.textContent = "Erneut versuchen";
    retryButton.addEventListener("click", () => void this.loadWarranty(true));
    content.append(errorBox, retryButton);
  }

  private createFrame(device: DeviceReference): HTMLDivElement {
    const content = document.createElement("div");
    content.className = "warranty-content";

    const headingRow = document.createElement("div");
    headingRow.className = "warranty-heading-row";
    const heading = document.createElement("h2");
    heading.textContent = device.deviceName;
    const closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.className = "popover-close-button";
    closeButton.setAttribute("aria-label", "Garantieinformationen schliessen");
    closeButton.textContent = "×";
    closeButton.addEventListener("click", () => this.close(true));
    headingRow.append(heading, closeButton);

    const serialNumber = document.createElement("p");
    serialNumber.className = "warranty-serial";
    serialNumber.textContent = `Seriennummer ${device.serialNumber}`;

    content.append(headingRow, serialNumber);
    this.#element.replaceChildren(content);
    return content;
  }

  private createCoverage(coverage: WarrantyCoverage): HTMLElement {
    const section = document.createElement("section");
    section.className = "coverage-card";
    const heading = document.createElement("h3");
    heading.textContent = coverage.warrantyType;
    const data = document.createElement("dl");

    if (coverage.purchaseDate !== undefined) {
      appendDefinition(data, "Kaufdatum", formatDateOnly(coverage.purchaseDate));
    }
    if (coverage.coverageStartDate !== undefined) {
      appendDefinition(data, "Garantiebeginn", formatDateOnly(coverage.coverageStartDate));
    }
    if (coverage.coverageEndDate !== undefined) {
      appendDefinition(data, "Garantieende", formatDateOnly(coverage.coverageEndDate));
    }

    section.append(heading, data);
    return section;
  }

  private readonly handleOutsidePointerDown = (event: PointerEvent): void => {
    const target = event.target;
    if (
      target instanceof Node &&
      !this.#element.contains(target) &&
      this.#anchor?.contains(target) !== true
    ) {
      this.close();
    }
  };

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (event.key === "Escape" && !this.#element.hidden) {
      event.preventDefault();
      this.close(true);
    }
  };

  private readonly reposition = (): void => {
    if (this.#anchor === null || this.#element.hidden) {
      return;
    }
    if (!this.#anchor.isConnected) {
      this.close();
      return;
    }

    const anchorRectangle = this.#anchor.getBoundingClientRect();
    const popoverRectangle = this.#element.getBoundingClientRect();
    const gap = 8;
    const pagePadding = 12;
    const availableBelow = window.innerHeight - anchorRectangle.bottom;
    const placeAbove =
      availableBelow < popoverRectangle.height + gap && anchorRectangle.top > availableBelow;
    const preferredTop = placeAbove
      ? anchorRectangle.top - popoverRectangle.height - gap
      : anchorRectangle.bottom + gap;
    const preferredLeft = anchorRectangle.left;
    const maximumLeft = window.innerWidth - popoverRectangle.width - pagePadding;

    this.#element.style.top = `${Math.max(pagePadding, preferredTop)}px`;
    this.#element.style.left = `${Math.max(pagePadding, Math.min(preferredLeft, maximumLeft))}px`;
  };
}

function appendDefinition(list: HTMLDListElement, term: string, description: string): void {
  const definitionTerm = document.createElement("dt");
  definitionTerm.textContent = term;
  const definitionDescription = document.createElement("dd");
  definitionDescription.textContent = description;
  list.append(definitionTerm, definitionDescription);
}

function errorTitle(code: string): string {
  const titles: Record<string, string> = {
    SERIAL_NOT_FOUND: "Seriennummer nicht gefunden",
    NO_WARRANTY_DATA: "Keine Garantiedaten vorhanden",
    NETWORK_ERROR: "Netzwerkfehler",
    SERVICE_UNAVAILABLE: "Garantiedienst nicht verfügbar",
    PERMISSION_DENIED: "Fehlende Berechtigung",
    UNKNOWN_ERROR: "Unbekannter Fehler",
  };
  return titles[code] ?? titles.UNKNOWN_ERROR ?? "Unbekannter Fehler";
}

function errorDescription(code: string): string {
  const descriptions: Record<string, string> = {
    SERIAL_NOT_FOUND: "Für diese Seriennummer wurde kein Gerät gefunden.",
    NO_WARRANTY_DATA: "Für dieses Gerät liegen keine Garantiedaten vor.",
    NETWORK_ERROR: "Die simulierte Anfrage konnte nicht übertragen werden.",
    SERVICE_UNAVAILABLE: "Der simulierte Garantiedienst ist momentan nicht erreichbar.",
    PERMISSION_DENIED: "Der Zugriff auf die Garantieinformationen wurde abgelehnt.",
    UNKNOWN_ERROR: "Die Garantieinformationen konnten nicht geladen werden.",
  };
  return descriptions[code] ?? descriptions.UNKNOWN_ERROR ?? "Unbekannter Fehler.";
}
