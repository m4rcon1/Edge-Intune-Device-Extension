import { describe, expect, it } from "vitest";
import { MockWarrantyProvider } from "../src/warranty/mock-warranty-provider";

describe("MockWarrantyProvider", () => {
  it("liefert nur die fachlich benötigten Garantiedaten", async () => {
    const provider = new MockWarrantyProvider(0, () => new Date("2026-08-19T08:00:00.000Z"));

    const result = await provider.getWarranty("pf123abc");

    expect(result).toMatchObject({
      serialNumber: "PF123ABC",
      checkedAt: "2026-08-19T08:00:00.000Z",
      coverages: [
        {
          warrantyType: "Premier Support",
          coverageStartDate: "2023-09-06",
          coverageEndDate: "2026-09-05",
        },
      ],
    });
  });

  it("liefert einen typisierten simulierten Fehler", async () => {
    const provider = new MockWarrantyProvider(0);

    await expect(provider.getWarranty("PF404404")).rejects.toMatchObject({
      code: "SERIAL_NOT_FOUND",
    });
  });
});
