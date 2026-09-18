import { afterEach, describe, expect, it, vi } from "vitest";
import { DeviceDecorator } from "../src/ui/device-decorator";
import { MockDeviceListAdapter } from "../src/ui/mock-device-list-adapter";

describe("DeviceDecorator", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it("fügt pro gültigem Gerät genau ein Informationssymbol ein", () => {
    document.body.innerHTML = createTable(
      "NB-PF123ABC",
      "D-MJ123ABC",
      "DESKTOP-1042",
      "NB-INVALID-NAME",
    );
    const tableBody = document.querySelector("tbody");
    if (tableBody === null) throw new Error("Test-Tabelle fehlt");
    const popover = {
      toggle: vi.fn(),
      closeIfAnchoredWithin: vi.fn(),
    };
    const decorator = new DeviceDecorator(new MockDeviceListAdapter(tableBody), popover);

    decorator.start();
    decorator.scan();
    decorator.scan();

    const buttons = tableBody.querySelectorAll<HTMLButtonElement>(".warranty-info-button");
    expect(buttons).toHaveLength(2);
    expect(Array.from(buttons, (button) => button.dataset.serialNumber)).toEqual([
      "PF123ABC",
      "MJ123ABC",
    ]);
    decorator.stop();
  });

  it("aktualisiert das Symbol, wenn eine virtualisierte Zeile wiederverwendet wird", async () => {
    document.body.innerHTML = createTable("NB-PF123ABC");
    const tableBody = document.querySelector("tbody");
    const name = document.querySelector<HTMLElement>(".device-name");
    if (tableBody === null || name === null) throw new Error("Test-Tabelle fehlt");
    const decorator = new DeviceDecorator(new MockDeviceListAdapter(tableBody), {
      toggle: vi.fn(),
      closeIfAnchoredWithin: vi.fn(),
    });
    decorator.start();

    name.textContent = "D-MJ555AAA";
    await waitForMutationObserver();
    expect(tableBody.querySelectorAll(".warranty-info-button")).toHaveLength(1);
    expect(
      tableBody.querySelector<HTMLButtonElement>(".warranty-info-button")?.dataset.serialNumber,
    ).toBe("MJ555AAA");

    name.textContent = "DESKTOP-REUSED";
    await waitForMutationObserver();
    expect(tableBody.querySelectorAll(".warranty-info-button")).toHaveLength(0);
    decorator.stop();
  });
});

function createTable(...deviceNames: string[]): string {
  const rows = deviceNames
    .map(
      (deviceName) =>
        `<tr><td><span class="device-entry"><span class="device-name">${deviceName}</span></span></td></tr>`,
    )
    .join("");
  return `<table><tbody>${rows}</tbody></table>`;
}

async function waitForMutationObserver(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}
