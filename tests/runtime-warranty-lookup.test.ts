import { describe, expect, it, vi } from "vitest";
import { RuntimeWarrantyLookup } from "../src/content/runtime-warranty-lookup";
import { MESSAGE_TYPES } from "../src/messaging/messages";

const SUCCESS_RESPONSE = {
  ok: true,
  type: "WARRANTY_RESULT",
  result: {
    warranty: {
      serialNumber: "PF123ABC",
      checkedAt: "2026-08-21T08:00:00.000Z",
      coverages: [{ warrantyType: "Premier Support" }],
    },
    fromCache: false,
    cachedAt: "2026-08-21T08:00:00.000Z",
  },
} as const;

describe("RuntimeWarrantyLookup", () => {
  it("sendet eine typsichere Anfrage an den Service Worker", async () => {
    const sendMessage = vi.fn().mockResolvedValue(SUCCESS_RESPONSE);
    const lookup = new RuntimeWarrantyLookup({ sendMessage });

    await expect(lookup.getWarranty("PF123ABC", { forceRefresh: true })).resolves.toEqual(
      SUCCESS_RESPONSE.result,
    );
    expect(sendMessage).toHaveBeenCalledWith({
      type: MESSAGE_TYPES.getWarranty,
      serialNumber: "PF123ABC",
      forceRefresh: true,
    });
  });

  it("rekonstruiert einen fachlichen Fehler für die bestehende UI", async () => {
    const lookup = new RuntimeWarrantyLookup({
      sendMessage: vi.fn().mockResolvedValue({
        ok: false,
        error: { code: "NO_WARRANTY_DATA", message: "Keine Garantiedaten vorhanden." },
      }),
    });

    await expect(lookup.getWarranty("PF000000")).rejects.toMatchObject({
      code: "NO_WARRANTY_DATA",
    });
  });

  it("weist eine beschädigte Background-Response als technischen Fehler zurück", async () => {
    const lookup = new RuntimeWarrantyLookup({
      sendMessage: vi.fn().mockResolvedValue({ ok: true, data: "ungültig" }),
    });

    await expect(lookup.getWarranty("PF123ABC")).rejects.toMatchObject({
      code: "UNKNOWN_ERROR",
    });
  });
});
