import { afterEach, describe, expect, it, vi } from "vitest";
import type { WarrantyLookupResult } from "../src/services/warranty-service";
import { DeviceDecorator } from "../src/ui/device-decorator";
import {
  IntuneDeviceListAdapter,
  isTrustedIntuneReferrer,
} from "../src/ui/intune-device-list-adapter";
import { PopoverController } from "../src/ui/popover-controller";

describe("IntuneDeviceListAdapter", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it("erkennt die semantische Signatur unabhängig von Sprache, Spaltenfolge und CSS-Klassen", async () => {
    const detailsList = createDetailsList(["NB-PF111AAA"], {
      deviceHeaderText: "Gerätename",
      deviceHeaderLast: true,
      generatedClassName: "css-random-987 root-generated-123",
    });
    document.body.append(detailsList);
    const adapter = new IntuneDeviceListAdapter(document);
    const onChange = vi.fn();

    adapter.start(onChange);
    await flushObservers();

    expect(adapter.getRoot()).toBe(detailsList);
    expect(adapter.findDeviceNameElements()).toHaveLength(1);
    expect(adapter.getDeviceName(adapter.findDeviceNameElements()[0] as HTMLElement)).toBe(
      "NB-PF111AAA",
    );
    expect(onChange).toHaveBeenCalled();
    adapter.stop();
  });

  it("akzeptiert weder beliebige Tabellen noch eine DetailsList ohne deviceName-Header", async () => {
    document.body.innerHTML = `
      <div role="table"><div role="rowheader"><a>NB-PF111AAA</a></div></div>
      <div data-automationid="DetailsList">
        <div role="table">
          <div role="columnheader" data-item-key="displayName">Name</div>
          <div role="rowheader" data-automation-key="deviceName"><a>NB-PF222BBB</a></div>
        </div>
      </div>
    `;
    const adapter = new IntuneDeviceListAdapter(document);
    const decorator = new DeviceDecorator(adapter, createPopover());

    decorator.start();
    await flushObservers();

    expect(adapter.getRoot()).toBeNull();
    expect(document.querySelectorAll(".warranty-info-button")).toHaveLength(0);
    decorator.stop();
  });

  it("verwendet den engen rowheader-Fallback nur innerhalb einer verifizierten Tabelle", async () => {
    document.body.append(createDetailsList(["NB-PF111AAA"], { useFallbackCells: true }));
    const adapter = new IntuneDeviceListAdapter(document);
    adapter.start(vi.fn());
    await flushObservers();

    expect(adapter.findDeviceNameElements()).toHaveLength(1);
    expect(adapter.getDeviceName(adapter.findDeviceNameElements()[0] as HTMLElement)).toBe(
      "NB-PF111AAA",
    );
    adapter.stop();
  });

  it("dekoriert Notebooks und Desktops unter anonymisierten Geräten genau einmal", async () => {
    const detailsList = createDetailsList([
      "NB-PF111AAA",
      "NB-PF222BBB",
      "D-MJ555EEE",
      "DESKTOP-TEST",
      "NB-PF333CCC",
      "TESTDEVICE",
      "NB-PF444DDD",
    ]);
    document.body.append(detailsList);
    const decorator = new DeviceDecorator(new IntuneDeviceListAdapter(document), createPopover());

    decorator.start();
    await flushObservers();
    decorator.scan();
    decorator.scan();
    await flushObservers();

    const buttons = detailsList.querySelectorAll<HTMLButtonElement>(
      ".warranty-info-button--intune",
    );
    expect(buttons).toHaveLength(5);
    expect(Array.from(buttons, (button) => button.dataset.serialNumber)).toEqual([
      "PF111AAA",
      "PF222BBB",
      "MJ555EEE",
      "PF333CCC",
      "PF444DDD",
    ]);
    for (const button of buttons) {
      expect(button.nextElementSibling?.tagName).toBe("A");
    }
    decorator.stop();
  });

  it("erkennt Erscheinen, Ersetzen, Entfernen und erneutes Erscheinen der DetailsList", async () => {
    const popover = createPopover();
    const adapter = new IntuneDeviceListAdapter(document);
    const decorator = new DeviceDecorator(adapter, popover);
    decorator.start();

    const first = createDetailsList(["NB-PF111AAA"]);
    document.body.append(first);
    await flushObservers();
    expect(first.querySelectorAll(".warranty-info-button")).toHaveLength(1);

    const second = createDetailsList(["NB-PF222BBB"]);
    first.replaceWith(second);
    await flushObservers();
    expect(first.querySelectorAll(".warranty-info-button")).toHaveLength(0);
    expect(
      second.querySelector<HTMLButtonElement>(".warranty-info-button")?.dataset.serialNumber,
    ).toBe("PF222BBB");

    second.remove();
    await flushObservers();
    expect(adapter.getRoot()).toBeNull();
    expect(popover.closeIfAnchoredWithin).toHaveBeenCalledWith(second);

    const third = createDetailsList(["NB-PF333CCC"]);
    document.body.append(third);
    await flushObservers();
    expect(third.querySelectorAll(".warranty-info-button")).toHaveLength(1);
    decorator.stop();
  });

  it("aktualisiert eine wiederverwendete Row und entfernt veraltete Dekoration", async () => {
    const detailsList = createDetailsList(["NB-PF111AAA"]);
    document.body.append(detailsList);
    const popover = createPopover();
    const decorator = new DeviceDecorator(new IntuneDeviceListAdapter(document), popover);
    decorator.start();
    await flushObservers();
    const nameLink = detailsList.querySelector<HTMLAnchorElement>("a");
    if (nameLink === null) throw new Error("Fixture-Link fehlt");

    nameLink.textContent = "D-MJ222BBB";
    await flushObservers();
    expect(
      detailsList.querySelector<HTMLButtonElement>(".warranty-info-button")?.dataset.serialNumber,
    ).toBe("MJ222BBB");
    expect(popover.closeIfAnchoredWithin).toHaveBeenCalled();

    nameLink.textContent = "DESKTOP-REUSED";
    await flushObservers();
    expect(detailsList.querySelectorAll(".warranty-info-button")).toHaveLength(0);
    decorator.stop();
  });

  it("ignoriert eine verspätete Antwort nach Row-Recycling", async () => {
    let resolveFirstRequest: ((result: WarrantyLookupResult) => void) | undefined;
    const firstRequest = new Promise<WarrantyLookupResult>((resolve) => {
      resolveFirstRequest = resolve;
    });
    const secondResult = createWarrantyResult("PF222BBB", "Aktuelle Garantie");
    const getWarranty = vi
      .fn()
      .mockReturnValueOnce(firstRequest)
      .mockResolvedValueOnce(secondResult);
    const controller = new PopoverController({
      getWarranty,
      clearCache: vi.fn().mockResolvedValue(undefined),
    });
    const detailsList = createDetailsList(["NB-PF111AAA"]);
    document.body.append(detailsList);
    const decorator = new DeviceDecorator(new IntuneDeviceListAdapter(document), controller);
    decorator.start();
    await flushObservers();

    detailsList.querySelector<HTMLButtonElement>(".warranty-info-button")?.click();
    const nameLink = detailsList.querySelector<HTMLAnchorElement>("a");
    if (nameLink === null) throw new Error("Fixture-Link fehlt");
    nameLink.textContent = "NB-PF222BBB";
    await flushObservers();
    detailsList.querySelector<HTMLButtonElement>(".warranty-info-button")?.click();
    await vi.waitFor(() =>
      expect(document.querySelector(".warranty-popover")?.textContent).toContain(
        "Aktuelle Garantie",
      ),
    );

    resolveFirstRequest?.(createWarrantyResult("PF111AAA", "Veraltete Garantie"));
    await Promise.resolve();

    expect(document.querySelector(".warranty-popover")?.textContent).toContain("NB-PF222BBB");
    expect(document.querySelector(".warranty-popover")?.textContent).not.toContain(
      "Veraltete Garantie",
    );
    decorator.stop();
    controller.destroy();
  });

  it("verweigert mehrdeutige gleichzeitige Gerätelisten", async () => {
    document.body.append(createDetailsList(["NB-PF111AAA"]), createDetailsList(["NB-PF222BBB"]));
    const adapter = new IntuneDeviceListAdapter(document);
    adapter.start(vi.fn());
    await flushObservers();

    expect(adapter.getRoot()).toBeNull();
    expect(adapter.findDeviceNameElements()).toHaveLength(0);
    adapter.stop();
  });
});

describe("Intune-Frame-Kontext", () => {
  it("akzeptiert nur die exakte Intune-Origin als Referrer", () => {
    expect(isTrustedIntuneReferrer("https://intune.microsoft.com/")).toBe(true);
    expect(isTrustedIntuneReferrer("https://intune.microsoft.com/some/path?value=test")).toBe(true);
    expect(isTrustedIntuneReferrer("https://intune.microsoft.com.example.test/")).toBe(false);
    expect(isTrustedIntuneReferrer("https://portal.azure.com/")).toBe(false);
    expect(isTrustedIntuneReferrer("")).toBe(false);
  });
});

interface FixtureOptions {
  deviceHeaderText?: string;
  deviceHeaderLast?: boolean;
  generatedClassName?: string;
  useFallbackCells?: boolean;
}

function createDetailsList(
  deviceNames: readonly string[],
  options: FixtureOptions = {},
): HTMLElement {
  const detailsList = document.createElement("div");
  detailsList.dataset.automationid = "DetailsList";
  detailsList.className = options.generatedClassName ?? "generated-class-not-used";

  const table = document.createElement("div");
  table.setAttribute("role", "table");
  const headerRow = document.createElement("div");
  headerRow.setAttribute("role", "row");
  const deviceHeader = document.createElement("div");
  deviceHeader.setAttribute("role", "columnheader");
  deviceHeader.dataset.itemKey = "deviceName";
  deviceHeader.textContent = options.deviceHeaderText ?? "Device name";
  const otherHeader = document.createElement("div");
  otherHeader.setAttribute("role", "columnheader");
  otherHeader.dataset.itemKey = "complianceState";
  otherHeader.textContent = "Compliance";
  headerRow.append(
    ...(options.deviceHeaderLast ? [otherHeader, deviceHeader] : [deviceHeader, otherHeader]),
  );
  table.append(headerRow, ...deviceNames.map((deviceName) => createRow(deviceName, options)));
  detailsList.append(table);
  return detailsList;
}

function createRow(deviceName: string, options: FixtureOptions): HTMLElement {
  const row = document.createElement("span");
  row.setAttribute("role", "row");
  const fields = document.createElement("div");
  fields.setAttribute("role", "presentation");
  fields.dataset.automationid = "DetailsRow";
  const deviceCell = document.createElement("div");
  deviceCell.setAttribute("role", "rowheader");
  deviceCell.dataset.automationid = "DetailsRowCell";
  if (options.useFallbackCells !== true) {
    deviceCell.dataset.automationKey = "deviceName";
  }
  const content = document.createElement("div");
  const link = document.createElement("a");
  const text = document.createElement("span");
  text.textContent = deviceName;
  link.append(text);
  content.append(link);
  deviceCell.append(content);
  const otherCell = document.createElement("div");
  otherCell.setAttribute("role", "gridcell");
  otherCell.dataset.automationKey = "complianceState";
  otherCell.textContent = "Compliant";
  fields.append(deviceCell, otherCell);
  row.append(fields);
  return row;
}

function createPopover() {
  return {
    toggle: vi.fn(),
    closeIfAnchoredWithin: vi.fn(),
  };
}

function createWarrantyResult(serialNumber: string, warrantyType: string): WarrantyLookupResult {
  return {
    warranty: {
      serialNumber,
      checkedAt: "2026-08-22T08:00:00.000Z",
      coverages: [{ warrantyType }],
    },
    fromCache: false,
    cachedAt: "2026-08-22T08:00:00.000Z",
  };
}

async function flushObservers(): Promise<void> {
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
  await Promise.resolve();
}
