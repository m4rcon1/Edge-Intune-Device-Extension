import { WarrantyError, type WarrantyInfo } from "../domain/warranty";
import type { WarrantyProvider, WarrantyRequestOptions } from "./warranty-provider";

const SUCCESS_RESPONSES: Readonly<Record<string, Omit<WarrantyInfo, "checkedAt">>> = {
  PF123ABC: {
    serialNumber: "PF123ABC",
    coverages: [
      {
        warrantyType: "Premier Support",
        purchaseDate: "2023-09-04",
        coverageStartDate: "2023-09-06",
        coverageEndDate: "2026-09-05",
      },
    ],
  },
  PF987XYZ: {
    serialNumber: "PF987XYZ",
    coverages: [
      {
        warrantyType: "Depot Support",
        coverageStartDate: "2022-02-18",
        coverageEndDate: "2025-02-17",
      },
      {
        warrantyType: "Garantieverlängerung",
        coverageStartDate: "2025-02-18",
        coverageEndDate: "2027-02-17",
      },
    ],
  },
  PF555AAA: {
    serialNumber: "PF555AAA",
    coverages: [
      {
        warrantyType: "Onsite Support",
        coverageStartDate: "2024-05-12",
        coverageEndDate: "2028-05-11",
      },
    ],
  },
};

const ERROR_RESPONSES: Readonly<Record<string, WarrantyError>> = {
  PF404404: new WarrantyError("SERIAL_NOT_FOUND", "Seriennummer nicht gefunden."),
  PF000000: new WarrantyError("NO_WARRANTY_DATA", "Keine Garantiedaten vorhanden."),
  PFNETWORK: new WarrantyError("NETWORK_ERROR", "Simulierter Netzwerkfehler."),
  PFOFFLINE: new WarrantyError("SERVICE_UNAVAILABLE", "Simulierter Dienstausfall."),
  PFDENIED: new WarrantyError("PERMISSION_DENIED", "Simulierte fehlende Berechtigung."),
};

export class MockWarrantyProvider implements WarrantyProvider {
  public constructor(
    private readonly delayMilliseconds = 650,
    private readonly now: () => Date = () => new Date(),
  ) {}

  public async getWarranty(
    serialNumber: string,
    options: WarrantyRequestOptions = {},
  ): Promise<WarrantyInfo> {
    const normalizedSerialNumber = serialNumber.toUpperCase();
    await wait(this.delayMilliseconds, options.signal);

    const configuredError = ERROR_RESPONSES[normalizedSerialNumber];
    if (configuredError !== undefined) {
      throw new WarrantyError(configuredError.code, configuredError.message);
    }

    const configuredResponse = SUCCESS_RESPONSES[normalizedSerialNumber];
    if (configuredResponse === undefined) {
      throw new WarrantyError("SERIAL_NOT_FOUND", "Seriennummer nicht gefunden.");
    }

    return {
      ...structuredClone(configuredResponse),
      checkedAt: this.now().toISOString(),
    };
  }
}

async function wait(milliseconds: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted === true) {
    throw getAbortReason(signal);
  }

  await new Promise<void>((resolve, reject) => {
    const timeout = globalThis.setTimeout(resolve, milliseconds);

    signal?.addEventListener(
      "abort",
      () => {
        globalThis.clearTimeout(timeout);
        reject(getAbortReason(signal));
      },
      { once: true },
    );
  });
}

function getAbortReason(signal: AbortSignal): Error {
  return signal.reason instanceof Error
    ? signal.reason
    : new DOMException("Die Abfrage wurde abgebrochen.", "AbortError");
}
