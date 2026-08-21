import { WarrantyError } from "../domain/warranty";
import {
  MESSAGE_TYPES,
  parseExtensionResponse,
  type ExtensionErrorResponse,
  type ExtensionRequest,
} from "../messaging/messages";
import type {
  WarrantyLookup,
  WarrantyLookupOptions,
  WarrantyLookupResult,
} from "../services/warranty-service";

export interface RuntimeMessenger {
  sendMessage(message: ExtensionRequest): Promise<unknown>;
}

export class RuntimeWarrantyLookup implements WarrantyLookup {
  public constructor(private readonly runtime: RuntimeMessenger) {}

  public async getWarranty(
    serialNumber: string,
    options: WarrantyLookupOptions = {},
  ): Promise<WarrantyLookupResult> {
    throwIfAborted(options.signal);

    const response = await this.send({
      type: MESSAGE_TYPES.getWarranty,
      serialNumber,
      forceRefresh: options.forceRefresh === true,
    });
    throwIfAborted(options.signal);

    if (response.ok === false) {
      throw toWarrantyError(response);
    }
    if (response.type !== "WARRANTY_RESULT") {
      throw new WarrantyError("UNKNOWN_ERROR", "Unerwartete Extension-Antwort.");
    }

    return response.result;
  }

  public async clearCache(): Promise<void> {
    const response = await this.send({ type: MESSAGE_TYPES.clearWarrantyCache });
    if (response.ok === false) {
      throw toWarrantyError(response);
    }
    if (response.type !== "CACHE_CLEARED") {
      throw new WarrantyError("UNKNOWN_ERROR", "Unerwartete Extension-Antwort.");
    }
  }

  private async send(message: ExtensionRequest) {
    try {
      const rawResponse = await this.runtime.sendMessage(message);
      const response = parseExtensionResponse(rawResponse);
      if (response === null) {
        throw new WarrantyError("UNKNOWN_ERROR", "Ungültige Extension-Antwort.");
      }
      return response;
    } catch (error) {
      if (error instanceof WarrantyError) {
        throw error;
      }
      throw new WarrantyError("UNKNOWN_ERROR", "Die Extension-Kommunikation ist fehlgeschlagen.", {
        cause: error,
      });
    }
  }
}

function toWarrantyError(response: ExtensionErrorResponse): WarrantyError {
  const warrantyCode =
    response.error.code === "INVALID_REQUEST" || response.error.code === "RUNTIME_ERROR"
      ? "UNKNOWN_ERROR"
      : response.error.code;
  return new WarrantyError(warrantyCode, response.error.message);
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted === true) {
    throw signal.reason instanceof Error
      ? signal.reason
      : new DOMException("Die Abfrage wurde abgebrochen.", "AbortError");
  }
}
