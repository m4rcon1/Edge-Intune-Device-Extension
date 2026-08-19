import { describe, expect, it } from "vitest";
import { MemoryWarrantyCache } from "../src/cache/memory-warranty-cache";
import { WarrantyError, type WarrantyInfo } from "../src/domain/warranty";
import { CACHE_DURATIONS, WarrantyService } from "../src/services/warranty-service";
import type { WarrantyProvider } from "../src/warranty/warranty-provider";

const WARRANTY: WarrantyInfo = {
  serialNumber: "PF123ABC",
  checkedAt: "2026-08-19T08:00:00.000Z",
  coverages: [
    {
      warrantyType: "Premier Support",
      coverageStartDate: "2023-08-19",
      coverageEndDate: "2026-08-18",
    },
  ],
};

class StubProvider implements WarrantyProvider {
  public calls = 0;

  public constructor(private readonly response: WarrantyInfo | WarrantyError) {}

  public async getWarranty(): Promise<WarrantyInfo> {
    this.calls += 1;
    if (this.response instanceof WarrantyError) {
      throw this.response;
    }
    return structuredClone(this.response);
  }
}

describe("WarrantyService", () => {
  it("cached erfolgreiche Antworten sieben Tage", async () => {
    let nowMilliseconds = Date.parse("2026-08-19T08:00:00.000Z");
    const clock = (): Date => new Date(nowMilliseconds);
    const provider = new StubProvider(WARRANTY);
    const service = new WarrantyService(provider, new MemoryWarrantyCache(clock), clock);

    const first = await service.getWarranty("PF123ABC");
    nowMilliseconds += CACHE_DURATIONS.successfulResultMilliseconds - 1;
    const second = await service.getWarranty("pf123abc");

    expect(first.fromCache).toBe(false);
    expect(second.fromCache).toBe(true);
    expect(provider.calls).toBe(1);

    nowMilliseconds += 2;
    await service.getWarranty("PF123ABC");
    expect(provider.calls).toBe(2);
  });

  it("cached fachlich negative Antworten 24 Stunden", async () => {
    const provider = new StubProvider(
      new WarrantyError("NO_WARRANTY_DATA", "Keine Garantiedaten vorhanden."),
    );
    const service = new WarrantyService(provider, new MemoryWarrantyCache());

    await expect(service.getWarranty("PF000000")).rejects.toMatchObject({
      code: "NO_WARRANTY_DATA",
    });
    await expect(service.getWarranty("PF000000")).rejects.toMatchObject({
      code: "NO_WARRANTY_DATA",
    });

    expect(provider.calls).toBe(1);
  });

  it("cached technische Fehler nicht", async () => {
    const provider = new StubProvider(new WarrantyError("NETWORK_ERROR", "Netzwerkfehler."));
    const service = new WarrantyService(provider, new MemoryWarrantyCache());

    await expect(service.getWarranty("PFNETWORK")).rejects.toMatchObject({
      code: "NETWORK_ERROR",
    });
    await expect(service.getWarranty("PFNETWORK")).rejects.toMatchObject({
      code: "NETWORK_ERROR",
    });

    expect(provider.calls).toBe(2);
  });

  it("umgeht den Cache bei einem manuellen Refresh", async () => {
    const provider = new StubProvider(WARRANTY);
    const service = new WarrantyService(provider, new MemoryWarrantyCache());

    await service.getWarranty("PF123ABC");
    const refreshed = await service.getWarranty("PF123ABC", { forceRefresh: true });

    expect(refreshed.fromCache).toBe(false);
    expect(provider.calls).toBe(2);
  });
});
