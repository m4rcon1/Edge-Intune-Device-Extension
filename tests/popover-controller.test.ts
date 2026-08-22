import { afterEach, describe, expect, it, vi } from "vitest";
import { WarrantyError } from "../src/domain/warranty";
import type { WarrantyLookup, WarrantyLookupResult } from "../src/services/warranty-service";
import { PopoverController } from "../src/ui/popover-controller";

const RESULT: WarrantyLookupResult = {
  warranty: {
    serialNumber: "PF123ABC",
    checkedAt: "2026-08-19T08:00:00.000Z",
    coverages: [
      {
        warrantyType: "Premier Support",
        coverageStartDate: "2023-09-06",
        coverageEndDate: "2026-09-05",
      },
    ],
  },
  fromCache: false,
  cachedAt: "2026-08-19T08:00:00.000Z",
};

describe("PopoverController", () => {
  let controller: PopoverController | undefined;

  afterEach(() => {
    controller?.destroy();
    controller = undefined;
    document.body.replaceChildren();
  });

  it("verändert den DOM vor dem ersten Öffnen nicht", () => {
    controller = new PopoverController(createLookup(vi.fn().mockResolvedValue(RESULT)));

    expect(document.querySelector(".warranty-popover")).toBeNull();
  });

  it("zeigt zuerst Laden und danach eindeutig bezeichnete Garantiedaten", async () => {
    const getWarranty = vi.fn().mockResolvedValue(RESULT);
    controller = new PopoverController(createLookup(getWarranty));
    const anchor = createAnchor();

    controller.toggle(anchor, { deviceName: "NB-PF123ABC", serialNumber: "PF123ABC" });

    expect(document.querySelector('[role="status"]')?.textContent).toContain("werden geladen");
    expectLenovoLink();
    await vi.waitFor(() => expect(document.querySelector(".coverage-card")).not.toBeNull());
    expect(document.querySelector(".warranty-popover")?.textContent).not.toContain("Kaufdatum");
    expect(document.querySelector(".warranty-popover")?.textContent).toContain("Garantietyp");
    expect(document.querySelector(".warranty-popover")?.textContent).toContain("Premier Support");
    expect(document.querySelector(".warranty-popover")?.textContent).toContain("Garantiebeginn");
    expect(document.querySelector(".warranty-popover")?.textContent).toContain("Garantieende");
    expectLenovoLink();
    expect(anchor.getAttribute("aria-expanded")).toBe("true");
  });

  it("schliesst durch erneuten Klick, Klick ausserhalb und Escape", async () => {
    controller = new PopoverController(createLookup(vi.fn().mockResolvedValue(RESULT)));
    const anchor = createAnchor();
    const device = { deviceName: "NB-PF123ABC", serialNumber: "PF123ABC" };

    controller.toggle(anchor, device);
    controller.toggle(anchor, device);
    expect(document.querySelector<HTMLDivElement>(".warranty-popover")?.hidden).toBe(true);

    controller.toggle(anchor, device);
    document.body.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    expect(document.querySelector<HTMLDivElement>(".warranty-popover")?.hidden).toBe(true);

    controller.toggle(anchor, device);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(document.querySelector<HTMLDivElement>(".warranty-popover")?.hidden).toBe(true);
    expect(document.activeElement).toBe(anchor);
  });

  it("zeigt verständliche Fehler und erlaubt einen erneuten Versuch", async () => {
    const getWarranty = vi
      .fn()
      .mockRejectedValueOnce(new WarrantyError("NETWORK_ERROR", "Netzwerkfehler."))
      .mockResolvedValueOnce(RESULT);
    controller = new PopoverController(createLookup(getWarranty));
    const anchor = createAnchor();

    controller.toggle(anchor, { deviceName: "NB-PFNETWORK", serialNumber: "PFNETWORK" });
    await vi.waitFor(() =>
      expect(document.querySelector('[role="alert"]')?.textContent).toContain("Netzwerkfehler"),
    );
    expectLenovoLink("PFNETWORK");

    document.querySelector<HTMLButtonElement>(".refresh-button")?.click();
    await vi.waitFor(() => expect(document.querySelector(".coverage-card")).not.toBeNull());
    expect(getWarranty).toHaveBeenLastCalledWith(
      "PFNETWORK",
      expect.objectContaining({ forceRefresh: true }),
    );
  });

  it("stellt externe Werte nur als Text dar", async () => {
    const resultWithMarkup: WarrantyLookupResult = {
      ...RESULT,
      warranty: {
        ...RESULT.warranty,
        coverages: [{ warrantyType: '<img src=x onerror="alert(1)">' }],
      },
    };
    controller = new PopoverController(createLookup(vi.fn().mockResolvedValue(resultWithMarkup)));

    controller.toggle(createAnchor(), {
      deviceName: "NB-PF123ABC",
      serialNumber: "PF123ABC",
    });
    await vi.waitFor(() => expect(document.querySelector(".coverage-card")).not.toBeNull());

    expect(document.querySelector(".coverage-card img")).toBeNull();
    expect(document.querySelector(".coverage-card")?.textContent).toContain("<img src=x");
  });

  it("zeigt keine verspätete Antwort des zuvor geöffneten Geräts", async () => {
    let resolveFirstRequest: ((value: WarrantyLookupResult) => void) | undefined;
    const firstRequest = new Promise<WarrantyLookupResult>((resolve) => {
      resolveFirstRequest = resolve;
    });
    const secondResult: WarrantyLookupResult = {
      ...RESULT,
      warranty: {
        ...RESULT.warranty,
        serialNumber: "PF987XYZ",
        coverages: [{ warrantyType: "Garantieverlängerung" }],
      },
    };
    const getWarranty = vi
      .fn()
      .mockReturnValueOnce(firstRequest)
      .mockResolvedValueOnce(secondResult);
    controller = new PopoverController(createLookup(getWarranty));
    const firstAnchor = createAnchor();
    const secondAnchor = createAnchor();

    controller.toggle(firstAnchor, {
      deviceName: "NB-PF123ABC",
      serialNumber: "PF123ABC",
    });
    controller.toggle(secondAnchor, {
      deviceName: "NB-PF987XYZ",
      serialNumber: "PF987XYZ",
    });
    await vi.waitFor(() =>
      expect(document.querySelector(".warranty-popover")?.textContent).toContain(
        "Garantieverlängerung",
      ),
    );

    resolveFirstRequest?.(RESULT);
    await Promise.resolve();

    expect(document.querySelector(".warranty-popover")?.textContent).toContain("NB-PF987XYZ");
    expect(document.querySelector(".warranty-popover")?.textContent).not.toContain(
      "Premier Support",
    );
  });

  it("schliesst beim Repositionieren, wenn der Anchor entfernt wurde", () => {
    controller = new PopoverController(createLookup(vi.fn().mockResolvedValue(RESULT)));
    const anchor = createAnchor();

    controller.toggle(anchor, { deviceName: "NB-PF123ABC", serialNumber: "PF123ABC" });
    anchor.remove();
    window.dispatchEvent(new Event("scroll"));

    expect(document.querySelector<HTMLDivElement>(".warranty-popover")?.hidden).toBe(true);
  });
});

function createLookup(getWarranty: WarrantyLookup["getWarranty"]): WarrantyLookup {
  return {
    getWarranty,
    clearCache: vi.fn().mockResolvedValue(undefined),
  };
}

function createAnchor(): HTMLButtonElement {
  const anchor = document.createElement("button");
  anchor.type = "button";
  document.body.append(anchor);
  return anchor;
}

function expectLenovoLink(serialNumber = "PF123ABC"): void {
  const link = document.querySelector<HTMLAnchorElement>(".lenovo-warranty-link");
  expect(link?.textContent).toBe("Weitere Informationen bei Lenovo ↗");
  expect(link?.href).toBe(`https://pcsupport.lenovo.com/ch/de/products/${serialNumber}/warranty`);
  expect(link?.target).toBe("_blank");
  expect(link?.rel.split(" ").sort()).toEqual(["noopener", "noreferrer"]);
}
