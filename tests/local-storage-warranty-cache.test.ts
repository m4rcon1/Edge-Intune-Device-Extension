import { beforeEach, describe, expect, it } from "vitest";
import { LocalStorageWarrantyCache } from "../src/cache/local-storage-warranty-cache";
import type { WarrantyCacheEntry } from "../src/cache/warranty-cache";

const ENTRY: WarrantyCacheEntry = {
  value: {
    kind: "success",
    warranty: {
      serialNumber: "PF123ABC",
      checkedAt: "2026-08-19T08:00:00.000Z",
      coverages: [{ warrantyType: "Premier Support", coverageEndDate: "2027-08-18" }],
    },
  },
  cachedAt: "2026-08-19T08:00:00.000Z",
  expiresAt: "2026-08-26T08:00:00.000Z",
};

describe("LocalStorageWarrantyCache", () => {
  beforeEach(() => localStorage.clear());

  it("speichert Werte normalisiert und liefert eine Kopie zurück", async () => {
    const cache = new LocalStorageWarrantyCache(
      localStorage,
      () => new Date("2026-08-20T08:00:00.000Z"),
    );

    await cache.set("pf123abc", ENTRY);
    const result = await cache.get("PF123ABC");

    expect(result).toEqual(ENTRY);
    expect(result).not.toBe(ENTRY);
  });

  it("entfernt einen abgelaufenen Eintrag", async () => {
    const cache = new LocalStorageWarrantyCache(
      localStorage,
      () => new Date("2026-08-27T08:00:00.000Z"),
    );

    await cache.set("PF123ABC", ENTRY);

    await expect(cache.get("PF123ABC")).resolves.toBeNull();
  });

  it("ignoriert beschädigte lokale Daten", async () => {
    localStorage.setItem("edge-intune-warranty-mock-cache-v1", "kein JSON");
    const cache = new LocalStorageWarrantyCache(localStorage);

    await expect(cache.get("PF123ABC")).resolves.toBeNull();
  });
});
