import { describe, expect, it, vi } from "vitest";
import { WarrantyError } from "../src/domain/warranty";
import { MESSAGE_TYPES } from "../src/messaging/messages";
import { WarrantyMessageHandler } from "../src/messaging/warranty-message-handler";
import type { WarrantyLookup, WarrantyLookupResult } from "../src/services/warranty-service";

const RESULT: WarrantyLookupResult = {
  warranty: {
    serialNumber: "PF123ABC",
    checkedAt: "2026-08-21T08:00:00.000Z",
    coverages: [{ warrantyType: "Premier Support", coverageEndDate: "2027-08-20" }],
  },
  fromCache: false,
  cachedAt: "2026-08-21T08:00:00.000Z",
};

describe("WarrantyMessageHandler", () => {
  it("verarbeitet eine erfolgreiche Anfrage", async () => {
    const getWarranty = vi.fn().mockResolvedValue(RESULT);
    const handler = new WarrantyMessageHandler(createLookup(getWarranty));

    await expect(
      handler.handle({
        type: MESSAGE_TYPES.getWarranty,
        serialNumber: "pf123abc",
        forceRefresh: false,
      }),
    ).resolves.toEqual({ ok: true, type: "WARRANTY_RESULT", result: RESULT });
    expect(getWarranty).toHaveBeenCalledWith("PF123ABC", { forceRefresh: false });
  });

  it("lehnt eine unbekannte Nachricht strukturiert ab", async () => {
    const handler = new WarrantyMessageHandler(createLookup(vi.fn()));
    await expect(handler.handle({ type: "UNKNOWN" })).resolves.toEqual({
      ok: false,
      error: { code: "INVALID_REQUEST", message: "Die Extension-Anfrage ist ungültig." },
    });
  });

  it.each([
    ["SERIAL_NOT_FOUND", "Seriennummer nicht gefunden."],
    ["NETWORK_ERROR", "Die Garantieinformationen konnten nicht übertragen werden."],
  ] as const)("serialisiert den Fehler %s ohne interne Details", async (code, publicMessage) => {
    const getWarranty = vi
      .fn()
      .mockRejectedValue(new WarrantyError(code, "Interne Provider-Details"));
    const handler = new WarrantyMessageHandler(createLookup(getWarranty));

    await expect(
      handler.handle({
        type: MESSAGE_TYPES.getWarranty,
        serialNumber: "PF123ABC",
        forceRefresh: false,
      }),
    ).resolves.toEqual({ ok: false, error: { code, message: publicMessage } });
  });

  it("gibt Refresh-Anfragen an die Datenebene weiter", async () => {
    const getWarranty = vi.fn().mockResolvedValue(RESULT);
    const handler = new WarrantyMessageHandler(createLookup(getWarranty));

    await handler.handle({
      type: MESSAGE_TYPES.getWarranty,
      serialNumber: "PF123ABC",
      forceRefresh: true,
    });

    expect(getWarranty).toHaveBeenCalledWith("PF123ABC", { forceRefresh: true });
  });

  it("löscht den Cache über eine eigene Nachricht", async () => {
    const clearCache = vi.fn().mockResolvedValue(undefined);
    const handler = new WarrantyMessageHandler(createLookup(vi.fn(), clearCache));

    await expect(handler.handle({ type: MESSAGE_TYPES.clearWarrantyCache })).resolves.toEqual({
      ok: true,
      type: "CACHE_CLEARED",
    });
    expect(clearCache).toHaveBeenCalledOnce();
  });
});

function createLookup(
  getWarranty: WarrantyLookup["getWarranty"],
  clearCache: WarrantyLookup["clearCache"] = vi.fn().mockResolvedValue(undefined),
): WarrantyLookup {
  return { getWarranty, clearCache };
}
