import { afterEach, describe, expect, it, vi } from "vitest";
import {
  LENOVO_WARRANTY_ENDPOINT,
  LenovoWebWarrantyProvider,
} from "../src/warranty/lenovo-web-warranty-provider";

const CURRENT_WARRANTY = {
  deliveryTypeName: "Vor-Ort-Support",
  name: "3Y On-site, 9X5",
  startDate: "2026-06-26",
  endDate: "2029-06-25",
};

describe("LenovoWebWarrantyProvider", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("sendet ausschliesslich den festen Lenovo-Request und mappt currentWarranty", async () => {
    const fetchImplementation = vi.fn().mockResolvedValue(
      response({
        code: 0,
        data: { currentWarranty: CURRENT_WARRANTY },
      }),
    );
    const provider = createProvider(fetchImplementation);

    await expect(provider.getWarranty("PF123ABC")).resolves.toEqual({
      serialNumber: "PF123ABC",
      checkedAt: "2026-08-22T10:00:00.000Z",
      coverages: [
        {
          warrantyType: "Vor-Ort-Support",
          coverageStartDate: "2026-06-26",
          coverageEndDate: "2029-06-25",
        },
      ],
    });
    expect(fetchImplementation).toHaveBeenCalledTimes(1);
    const request = fetchImplementation.mock.calls[0] as
      [RequestInfo | URL, RequestInit] | undefined;
    expect(request?.[0]).toBe(LENOVO_WARRANTY_ENDPOINT);
    expect(request?.[1]).toMatchObject({
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      credentials: "omit",
      body: JSON.stringify({ serialNumber: "PF123ABC", country: "ch", language: "de" }),
    });
    expect(request?.[1].signal).toBeInstanceOf(AbortSignal);

    const requestOptions = request?.[1] as RequestInit;
    expect(Object.keys(requestOptions.headers as Record<string, string>).sort()).toEqual([
      "Accept",
      "Content-Type",
    ]);
  });

  it("sendet keine Anfrage für eine intern ungültige Seriennummer", async () => {
    const fetchImplementation = vi.fn();
    const provider = createProvider(fetchImplementation);

    await expect(provider.getWarranty("PF 123/ABC")).rejects.toMatchObject({
      code: "UNKNOWN_ERROR",
    });
    expect(fetchImplementation).not.toHaveBeenCalled();
  });

  it("verwendet name als Fallback für einen fehlenden deliveryTypeName", async () => {
    const provider = createProvider(
      vi.fn().mockResolvedValue(
        response({
          code: 0,
          data: { currentWarranty: { ...CURRENT_WARRANTY, deliveryTypeName: " " } },
        }),
      ),
    );

    const result = await provider.getWarranty("PF123ABC");
    expect(result.coverages[0]?.warrantyType).toBe("3Y On-site, 9X5");
  });

  it("ignoriert zusätzliche baseWarranties vollständig", async () => {
    const provider = createProvider(
      vi.fn().mockResolvedValue(
        response({
          code: 0,
          data: {
            currentWarranty: CURRENT_WARRANTY,
            baseWarranties: [
              CURRENT_WARRANTY,
              {
                name: "1YR Battery",
                startDate: "2026-06-26",
                endDate: "2027-06-25",
              },
            ],
          },
        }),
      ),
    );

    const result = await provider.getWarranty("PF123ABC");
    expect(result.coverages).toHaveLength(1);
    expect(JSON.stringify(result)).not.toContain("Battery");
  });

  it("meldet fehlende Typfelder als kontrollierten technischen Fehler", async () => {
    const provider = createProvider(
      vi.fn().mockResolvedValue(
        response({
          code: 0,
          data: {
            currentWarranty: {
              startDate: "2026-06-26",
              endDate: "2029-06-25",
            },
          },
        }),
      ),
    );

    await expect(provider.getWarranty("PF123ABC")).rejects.toMatchObject({
      code: "UNKNOWN_ERROR",
    });
  });

  it("mappt Lenovos code 100 auf SERIAL_NOT_FOUND", async () => {
    const provider = createProvider(vi.fn().mockResolvedValue(response({ code: 100, data: null })));

    await expect(provider.getWarranty("PF404404")).rejects.toMatchObject({
      code: "SERIAL_NOT_FOUND",
    });
  });

  it("mappt eine plausibel leere currentWarranty auf NO_WARRANTY_DATA", async () => {
    const provider = createProvider(
      vi.fn().mockResolvedValue(response({ code: 0, data: { currentWarranty: null } })),
    );

    await expect(provider.getWarranty("PF000000")).rejects.toMatchObject({
      code: "NO_WARRANTY_DATA",
    });
  });

  it.each([
    { payload: null, label: "kein Objekt" },
    { payload: { code: "0", data: {} }, label: "falscher Code-Typ" },
    { payload: { code: 0 }, label: "fehlende Daten" },
    {
      payload: { code: 0, data: { currentWarranty: { ...CURRENT_WARRANTY, startDate: 42 } } },
      label: "falscher Datumstyp",
    },
    {
      payload: {
        code: 0,
        data: { currentWarranty: { ...CURRENT_WARRANTY, endDate: "2029-02-29" } },
      },
      label: "ungültiger Kalendertag",
    },
  ])("weist ein ungültiges Schema zurück: $label", async ({ payload }) => {
    const provider = createProvider(vi.fn().mockResolvedValue(response(payload)));

    await expect(provider.getWarranty("PF123ABC")).rejects.toMatchObject({
      code: "UNKNOWN_ERROR",
    });
  });

  it.each([
    [401, "PERMISSION_DENIED"],
    [403, "PERMISSION_DENIED"],
    [429, "SERVICE_UNAVAILABLE"],
    [500, "SERVICE_UNAVAILABLE"],
    [503, "SERVICE_UNAVAILABLE"],
  ])("mappt HTTP %i auf %s", async (status, code) => {
    const provider = createProvider(vi.fn().mockResolvedValue(response({}, { status, ok: false })));

    await expect(provider.getWarranty("PF123ABC")).rejects.toMatchObject({ code });
  });

  it("behandelt ungültiges JSON als technischen Fehler", async () => {
    const provider = createProvider(
      vi.fn().mockResolvedValue(
        response(undefined, {
          jsonError: new SyntaxError("Testdaten sind kein JSON"),
        }),
      ),
    );

    await expect(provider.getWarranty("PF123ABC")).rejects.toMatchObject({
      code: "UNKNOWN_ERROR",
    });
  });

  it("mappt einen Fetch-Fehler auf NETWORK_ERROR", async () => {
    const provider = createProvider(vi.fn().mockRejectedValue(new TypeError("offline")));

    await expect(provider.getWarranty("PF123ABC")).rejects.toMatchObject({
      code: "NETWORK_ERROR",
    });
  });

  it("bricht einen zu langen Request nach dem konfigurierten Timeout ab", async () => {
    vi.useFakeTimers();
    const fetchImplementation = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener(
          "abort",
          () => reject(new DOMException("abgebrochen", "AbortError")),
          { once: true },
        );
      });
    });
    const provider = new LenovoWebWarrantyProvider(
      fetchImplementation,
      () => new Date("2026-08-22T10:00:00.000Z"),
      50,
    );

    const expectation = expect(provider.getWarranty("PF123ABC")).rejects.toMatchObject({
      code: "NETWORK_ERROR",
    });
    await vi.advanceTimersByTimeAsync(51);
    await expectation;
    expect((fetchImplementation.mock.calls[0]?.[1] as RequestInit).signal?.aborted).toBe(true);
  });
});

function createProvider(fetchImplementation: ReturnType<typeof vi.fn>): LenovoWebWarrantyProvider {
  return new LenovoWebWarrantyProvider(
    fetchImplementation,
    () => new Date("2026-08-22T10:00:00.000Z"),
  );
}

function response(
  payload: unknown,
  options: { status?: number; ok?: boolean; jsonError?: Error } = {},
): Response {
  return {
    ok: options.ok ?? true,
    status: options.status ?? 200,
    json: options.jsonError
      ? vi.fn().mockRejectedValue(options.jsonError)
      : vi.fn().mockResolvedValue(payload),
  } as unknown as Response;
}
