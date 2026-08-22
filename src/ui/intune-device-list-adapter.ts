import type { DeviceListAdapter } from "./device-list-adapter";

const DETAILS_LIST_SELECTOR = '[data-automationid="DetailsList"]';
const TABLE_SELECTOR = '[role="table"]';
const DEVICE_HEADER_SELECTOR = '[role="columnheader"][data-item-key="deviceName"]';
const DEVICE_CELL_SELECTOR = '[role="rowheader"][data-automation-key="deviceName"]';
const FALLBACK_CELL_SELECTOR = '[role="rowheader"][data-automationid="DetailsRowCell"]';
const INTUNE_ORIGIN = "https://intune.microsoft.com";

interface VerifiedDeviceList {
  detailsList: HTMLElement;
  table: HTMLElement;
}

export class IntuneDeviceListAdapter implements DeviceListAdapter {
  public readonly buttonClassName = "warranty-info-button--intune";
  readonly #lifecycleObserver: MutationObserver;
  readonly #listObserver: MutationObserver;
  #onChange: (() => void) | null = null;
  #detailsList: HTMLElement | null = null;
  #table: HTMLElement | null = null;
  #reconcileScheduled = false;
  #changeScheduled = false;

  public constructor(private readonly document: Document) {
    this.#lifecycleObserver = new MutationObserver((mutations) => {
      if (this.lifecycleMayHaveChanged(mutations)) {
        this.scheduleReconcile();
      }
    });
    this.#listObserver = new MutationObserver(() => this.handleListMutation());
  }

  public start(onChange: () => void): void {
    this.#onChange = onChange;
    this.#lifecycleObserver.observe(this.document.body, {
      childList: true,
      subtree: true,
    });
    this.reconcileDocument();
  }

  public stop(): void {
    this.#lifecycleObserver.disconnect();
    this.#listObserver.disconnect();
    this.#detailsList = null;
    this.#table = null;
    this.#onChange = null;
    this.#reconcileScheduled = false;
    this.#changeScheduled = false;
  }

  public getRoot(): HTMLElement | null {
    return this.#detailsList;
  }

  public findDeviceNameElements(): readonly HTMLElement[] {
    return this.#table === null ? [] : findDeviceNameLinks(this.#table);
  }

  public getDeviceName(nameElement: HTMLElement): string {
    return nameElement.textContent ?? "";
  }

  public insertInformationButton(nameElement: HTMLElement, button: HTMLButtonElement): void {
    nameElement.before(button);
  }

  private lifecycleMayHaveChanged(mutations: readonly MutationRecord[]): boolean {
    if (this.#detailsList !== null && !this.#detailsList.isConnected) {
      return true;
    }

    return mutations.some((mutation) =>
      [...mutation.addedNodes, ...mutation.removedNodes].some((node) =>
        nodeMayContainDeviceList(node),
      ),
    );
  }

  private handleListMutation(): void {
    if (this.#detailsList === null) {
      return;
    }

    const verified = verifyDetailsList(this.#detailsList);
    if (verified === null) {
      this.setCurrentList(null);
      return;
    }

    this.#table = verified.table;
    this.scheduleChange();
  }

  private scheduleReconcile(): void {
    if (this.#reconcileScheduled) {
      return;
    }

    this.#reconcileScheduled = true;
    queueMicrotask(() => {
      this.#reconcileScheduled = false;
      if (this.#onChange !== null) {
        this.reconcileDocument();
      }
    });
  }

  private reconcileDocument(): void {
    this.setCurrentList(findVerifiedDeviceList(this.document));
  }

  private setCurrentList(next: VerifiedDeviceList | null): void {
    const nextDetailsList = next?.detailsList ?? null;
    const nextTable = next?.table ?? null;
    const rootChanged = nextDetailsList !== this.#detailsList;
    const tableChanged = nextTable !== this.#table;

    if (rootChanged) {
      this.#listObserver.disconnect();
    }

    this.#detailsList = nextDetailsList;
    this.#table = nextTable;

    if (rootChanged && nextDetailsList !== null) {
      this.#listObserver.observe(nextDetailsList, {
        childList: true,
        subtree: true,
        characterData: true,
      });
    }

    if (rootChanged || tableChanged) {
      this.scheduleChange();
    }
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

export function isTrustedIntuneReferrer(referrer: string): boolean {
  try {
    return new URL(referrer).origin === INTUNE_ORIGIN;
  } catch {
    return false;
  }
}

function findVerifiedDeviceList(document: Document): VerifiedDeviceList | null {
  const matches = Array.from(document.querySelectorAll<HTMLElement>(DETAILS_LIST_SELECTOR)).flatMap(
    (detailsList) => {
      const verified = verifyDetailsList(detailsList);
      return verified === null ? [] : [verified];
    },
  );

  return matches.length === 1 ? (matches[0] ?? null) : null;
}

function verifyDetailsList(detailsList: HTMLElement): VerifiedDeviceList | null {
  const matchingTables = Array.from(
    detailsList.querySelectorAll<HTMLElement>(TABLE_SELECTOR),
  ).filter((table) => {
    const headers = descendantsOwnedBy(table, DEVICE_HEADER_SELECTOR, TABLE_SELECTOR);
    return headers.length === 1 && findDeviceNameLinks(table).length > 0;
  });

  if (matchingTables.length !== 1) {
    return null;
  }

  return { detailsList, table: matchingTables[0] as HTMLElement };
}

function findDeviceNameLinks(table: HTMLElement): HTMLElement[] {
  const primaryCells = descendantsOwnedBy(table, DEVICE_CELL_SELECTOR, TABLE_SELECTOR);
  if (primaryCells.length > 0) {
    return primaryCells.flatMap(findSingleLink);
  }

  const links: HTMLElement[] = [];
  for (const row of descendantsOwnedBy(table, '[role="row"]', TABLE_SELECTOR)) {
    const cells = descendantsOwnedBy(row, FALLBACK_CELL_SELECTOR, '[role="row"]').filter(
      (cell) => cell.closest(TABLE_SELECTOR) === table,
    );
    if (cells.length === 1) {
      links.push(...findSingleLink(cells[0] as HTMLElement));
    }
  }
  return links;
}

function findSingleLink(cell: HTMLElement): HTMLElement[] {
  const links = Array.from(cell.querySelectorAll<HTMLElement>("a"));
  return links.length === 1 ? links : [];
}

function descendantsOwnedBy(
  root: HTMLElement,
  selector: string,
  ownerSelector: string,
): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(selector)).filter(
    (element) => element.closest(ownerSelector) === root,
  );
}

function nodeMayContainDeviceList(node: Node): boolean {
  if (!(node instanceof Element)) {
    return false;
  }

  return [
    DETAILS_LIST_SELECTOR,
    DEVICE_HEADER_SELECTOR,
    DEVICE_CELL_SELECTOR,
    FALLBACK_CELL_SELECTOR,
  ].some((selector) => node.matches(selector) || node.querySelector(selector) !== null);
}
