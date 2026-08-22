import { LENOVO_WEB_CONFIG } from "../lenovo/lenovo-web-config";
import { normalizeSerialNumber } from "../domain/device-name";
import { WarrantyError, type WarrantyInfo } from "../domain/warranty";
import type { WarrantyProvider, WarrantyRequestOptions } from "./warranty-provider";

type FetchImplementation = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export const LENOVO_WARRANTY_ENDPOINT =
  `${LENOVO_WEB_CONFIG.origin}/${LENOVO_WEB_CONFIG.country}/${LENOVO_WEB_CONFIG.language}` +
  "/api/v4/upsell/redport/getIbaseInfo";

const LENOVO_REQUEST_TIMEOUT_MILLISECONDS = 10_000;

/**
 * Uses the undocumented JSON endpoint behind Lenovo's public warranty website.
 * This is not an official API contract and must remain isolated behind WarrantyProvider.
 */
export class LenovoWebWarrantyProvider implements WarrantyProvider {
  public constructor(
    private readonly fetchImplementation: FetchImplementation = globalThis.fetch,
    private readonly now: () => Date = () => new Date(),
    private readonly timeoutMilliseconds: number = LENOVO_REQUEST_TIMEOUT_MILLISECONDS,
  ) {}

  public async getWarranty(
    serialNumber: string,
    options: WarrantyRequestOptions = {},
  ): Promise<WarrantyInfo> {
    const normalizedSerialNumber = normalizeSerialNumber(serialNumber);
    if (normalizedSerialNumber === null) {
      throw new WarrantyError("UNKNOWN_ERROR", "Die interne Seriennummer ist ungültig.");
    }

    const abortController = new AbortController();
    const timeout = globalThis.setTimeout(() => abortController.abort(), this.timeoutMilliseconds);
    const abortFromCaller = (): void => abortController.abort(options.signal?.reason);

    if (options.signal?.aborted === true) {
      abortFromCaller();
    } else {
      options.signal?.addEventListener("abort", abortFromCaller, { once: true });
    }

    try {
      const response = await this.fetchImplementation(LENOVO_WARRANTY_ENDPOINT, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        credentials: "omit",
        body: JSON.stringify({
          serialNumber: normalizedSerialNumber,
          country: LENOVO_WEB_CONFIG.country,
          language: LENOVO_WEB_CONFIG.language,
        }),
        signal: abortController.signal,
      });

      this.throwForHttpStatus(response);
      const payload = await parseJson(response);
      const coverage = extractCurrentWarranty(payload);

      return {
        serialNumber: normalizedSerialNumber,
        checkedAt: this.now().toISOString(),
        coverages: [coverage],
      };
    } catch (error) {
      if (error instanceof WarrantyError) {
        throw error;
      }

      throw new WarrantyError(
        "NETWORK_ERROR",
        "Die Lenovo-Garantieinformationen konnten nicht übertragen werden.",
        { cause: error },
      );
    } finally {
      globalThis.clearTimeout(timeout);
      options.signal?.removeEventListener("abort", abortFromCaller);
    }
  }

  private throwForHttpStatus(response: Response): void {
    if (response.ok) {
      return;
    }

    if (response.status === 401 || response.status === 403) {
      throw new WarrantyError(
        "PERMISSION_DENIED",
        "Lenovo hat den Zugriff auf die Garantieinformationen abgelehnt.",
      );
    }

    if (response.status === 429 || response.status >= 500) {
      throw new WarrantyError(
        "SERVICE_UNAVAILABLE",
        "Der Lenovo-Garantiedienst ist momentan nicht verfügbar.",
      );
    }

    throw new WarrantyError(
      "UNKNOWN_ERROR",
      "Der Lenovo-Garantiedienst hat unerwartet geantwortet.",
    );
  }
}

async function parseJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch (error) {
    throw new WarrantyError(
      "UNKNOWN_ERROR",
      "Der Lenovo-Garantiedienst hat keine gültigen Daten geliefert.",
      { cause: error },
    );
  }
}

function extractCurrentWarranty(payload: unknown): WarrantyInfo["coverages"][number] {
  if (!isRecord(payload) || typeof payload.code !== "number") {
    throw unexpectedSchema();
  }

  if (payload.code === 100 && payload.data === null) {
    throw new WarrantyError("SERIAL_NOT_FOUND", "Seriennummer nicht gefunden.");
  }

  if (payload.code !== 0) {
    throw unexpectedSchema();
  }

  if (!isRecord(payload.data)) {
    throw unexpectedSchema();
  }

  const currentWarranty = payload.data.currentWarranty;
  if (currentWarranty === null || currentWarranty === undefined) {
    throw new WarrantyError("NO_WARRANTY_DATA", "Keine Garantiedaten vorhanden.");
  }
  if (!isRecord(currentWarranty)) {
    throw unexpectedSchema();
  }

  const warrantyType = firstNonEmptyString(currentWarranty.deliveryTypeName, currentWarranty.name);
  if (
    warrantyType === null ||
    !isDateOnly(currentWarranty.startDate) ||
    !isDateOnly(currentWarranty.endDate)
  ) {
    throw unexpectedSchema();
  }

  return {
    warrantyType,
    coverageStartDate: currentWarranty.startDate,
    coverageEndDate: currentWarranty.endDate,
  };
}

function firstNonEmptyString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }
  return null;
}

function isDateOnly(value: unknown): value is string {
  if (typeof value !== "string") {
    return false;
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (match === null) {
    return false;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

function unexpectedSchema(): WarrantyError {
  return new WarrantyError(
    "UNKNOWN_ERROR",
    "Der Lenovo-Garantiedienst hat ein unerwartetes Datenformat geliefert.",
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
