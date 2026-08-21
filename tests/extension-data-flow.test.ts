import { describe, expect, it } from "vitest";
import { ChromeStorageWarrantyCache } from "../src/cache/chrome-storage-warranty-cache";
import { WarrantyError, type WarrantyInfo } from "../src/domain/warranty";
import { MESSAGE_TYPES } from "../src/messaging/messages";
import { WarrantyMessageHandler } from "../src/messaging/warranty-message-handler";
import { WarrantyService } from "../src/services/warranty-service";
import type { WarrantyProvider } from "../src/warranty/warranty-provider";
import { FakeExtensionStorage } from "./helpers/fake-extension-storage";

const WARRANTY: WarrantyInfo = {
  serialNumber: "PF123ABC",
  checkedAt: "2026-08-21T08:00:00.000Z",
  coverages: [{ warrantyType: "Premier Support", coverageEndDate: "2027-08-20" }],
};

class CountingProvider implements WarrantyProvider {
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

describe("Extension-Datenfluss", () => {
  it("ruft den Provider nur bei einem Extension-Cache-Miss auf", async () => {
    const provider = new CountingProvider(WARRANTY);
    const handler = createHandler(provider);
    const request = {
      type: MESSAGE_TYPES.getWarranty,
      serialNumber: "PF123ABC",
      forceRefresh: false,
    } as const;

    const first = await handler.handle(request);
    const second = await handler.handle(request);

    expect(first).toMatchObject({ ok: true, type: "WARRANTY_RESULT" });
    expect(second).toMatchObject({
      ok: true,
      type: "WARRANTY_RESULT",
      result: { fromCache: true },
    });
    expect(provider.calls).toBe(1);
  });

  it("umgeht den persistenten Extension-Cache beim Refresh", async () => {
    const provider = new CountingProvider(WARRANTY);
    const handler = createHandler(provider);

    await handler.handle({
      type: MESSAGE_TYPES.getWarranty,
      serialNumber: "PF123ABC",
      forceRefresh: false,
    });
    await handler.handle({
      type: MESSAGE_TYPES.getWarranty,
      serialNumber: "PF123ABC",
      forceRefresh: true,
    });

    expect(provider.calls).toBe(2);
  });

  it("cached technische Fehler nicht", async () => {
    const provider = new CountingProvider(
      new WarrantyError("SERVICE_UNAVAILABLE", "Interner Testfehler"),
    );
    const handler = createHandler(provider);
    const request = {
      type: MESSAGE_TYPES.getWarranty,
      serialNumber: "PFOFFLINE",
      forceRefresh: false,
    } as const;

    await handler.handle(request);
    await handler.handle(request);

    expect(provider.calls).toBe(2);
  });
});

function createHandler(provider: WarrantyProvider): WarrantyMessageHandler {
  const clock = () => new Date("2026-08-21T08:00:00.000Z");
  const cache = new ChromeStorageWarrantyCache(new FakeExtensionStorage(), clock);
  return new WarrantyMessageHandler(new WarrantyService(provider, cache, clock));
}
