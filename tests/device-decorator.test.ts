import { afterEach, describe, expect, it, vi } from "vitest";
import { DeviceDecorator } from "../src/ui/device-decorator";

describe("DeviceDecorator", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it("fügt pro gültigem Gerät genau ein Informationssymbol ein", () => {
    document.body.innerHTML = createTable("NB-PF123ABC", "DESKTOP-1042", "NB-INVALID-NAME");
    const tableBody = document.querySelector("tbody");
    if (tableBody === null) throw new Error("Test-Tabelle fehlt");
    const popover = {
      toggle: vi.fn(),
      closeIfAnchoredWithin: vi.fn(),
    };
    const decorator = new DeviceDecorator(tableBody, popover);

    decorator.start();
    decorator.scan();
    decorator.scan();

    expect(tableBody.querySelectorAll(".warranty-info-button")).toHaveLength(1);
    expect(
      tableBody.querySelector<HTMLButtonElement>(".warranty-info-button")?.dataset.serialNumber,
    ).toBe("PF123ABC");
    decorator.stop();
  });

  it("aktualisiert das Symbol, wenn eine virtualisierte Zeile wiederverwendet wird", async () => {
    document.body.innerHTML = createTable("NB-PF123ABC");
    const tableBody = document.querySelector("tbody");
    const name = document.querySelector<HTMLElement>(".device-name");
    if (tableBody === null || name === null) throw new Error("Test-Tabelle fehlt");
    const decorator = new DeviceDecorator(tableBody, {
      toggle: vi.fn(),
      closeIfAnchoredWithin: vi.fn(),
    });
    decorator.start();

    name.textContent = "NB-PF555AAA";
    await waitForMutationObserver();
    expect(tableBody.querySelectorAll(".warranty-info-button")).toHaveLength(1);
    expect(
      tableBody.querySelector<HTMLButtonElement>(".warranty-info-button")?.dataset.serialNumber,
    ).toBe("PF555AAA");

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
