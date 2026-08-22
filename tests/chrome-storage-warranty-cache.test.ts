import { describe, expect, it } from "vitest";
import {
  ChromeStorageWarrantyCache,
  WARRANTY_CACHE_NAMESPACES,
} from "../src/cache/chrome-storage-warranty-cache";
import type { WarrantyCacheEntry } from "../src/cache/warranty-cache";
import { FakeExtensionStorage } from "./helpers/fake-extension-storage";

const SUCCESS_ENTRY: WarrantyCacheEntry = {
  value: {
    kind: "success",
    warranty: {
      serialNumber: "PF123ABC",
      checkedAt: "2026-08-21T08:00:00.000Z",
      coverages: [{ warrantyType: "Premier Support", coverageEndDate: "2027-08-20" }],
    },
  },
  cachedAt: "2026-08-21T08:00:00.000Z",
  expiresAt: "2026-08-28T08:00:00.000Z",
};

const NEGATIVE_ENTRY: WarrantyCacheEntry = {
  value: {
    kind: "failure",
    errorCode: "NO_WARRANTY_DATA",
    message: "Keine Garantiedaten vorhanden.",
  },
  cachedAt: "2026-08-21T08:00:00.000Z",
  expiresAt: "2026-08-22T08:00:00.000Z",
};

describe("ChromeStorageWarrantyCache", () => {
  it("liefert bei einem Cache Miss null", async () => {
    const cache = createCache(new FakeExtensionStorage(), "2026-08-21T09:00:00.000Z");
    await expect(cache.get("PF123ABC")).resolves.toBeNull();
  });

  it("speichert und liest einen normalisierten Cache Hit", async () => {
    const storage = new FakeExtensionStorage();
    const cache = createCache(storage, "2026-08-21T09:00:00.000Z");

    await cache.set("pf123abc", SUCCESS_ENTRY);

    await expect(cache.get("PF123ABC")).resolves.toEqual(SUCCESS_ENTRY);
  });

  it("entfernt ein abgelaufenes erfolgreiches Ergebnis", async () => {
    const storage = new FakeExtensionStorage();
    const cache = createCache(storage, "2026-08-28T08:00:00.001Z");
    await cache.set("PF123ABC", SUCCESS_ENTRY);

    await expect(cache.get("PF123ABC")).resolves.toBeNull();
    expect(storage.read("warranty-cache-v1:PF123ABC")).toBeUndefined();
  });

  it("entfernt ein abgelaufenes negatives Ergebnis", async () => {
    const storage = new FakeExtensionStorage();
    const cache = createCache(storage, "2026-08-22T08:00:00.001Z");
    await cache.set("PF000000", NEGATIVE_ENTRY);

    await expect(cache.get("PF000000")).resolves.toBeNull();
  });

  it("löscht nur Warranty-Cache-Einträge", async () => {
    const storage = new FakeExtensionStorage();
    const cache = createCache(storage, "2026-08-21T09:00:00.000Z");
    await cache.set("PF123ABC", SUCCESS_ENTRY);
    await storage.set({ "future-extension-setting": true });

    await cache.clear();

    expect(storage.read("warranty-cache-v1:PF123ABC")).toBeUndefined();
    expect(storage.read("future-extension-setting")).toBe(true);
  });

  it("trennt echte Lenovo-Daten vom bisherigen Mock-Cache", async () => {
    const storage = new FakeExtensionStorage();
    await storage.set({ "warranty-cache-v1:PF123ABC": SUCCESS_ENTRY });
    const cache = new ChromeStorageWarrantyCache(
      storage,
      () => new Date("2026-08-21T09:00:00.000Z"),
      WARRANTY_CACHE_NAMESPACES.lenovoWeb,
    );

    await expect(cache.get("PF123ABC")).resolves.toBeNull();
    await cache.set("PF123ABC", SUCCESS_ENTRY);

    expect(storage.read("warranty-cache-v1:PF123ABC")).toEqual(SUCCESS_ENTRY);
    expect(storage.read("warranty-cache-v2:lenovo-web:PF123ABC")).toEqual(SUCCESS_ENTRY);
  });
});

function createCache(storage: FakeExtensionStorage, now: string): ChromeStorageWarrantyCache {
  return new ChromeStorageWarrantyCache(storage, () => new Date(now));
}
