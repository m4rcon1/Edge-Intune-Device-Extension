import { normalizeWarrantyError } from "../domain/warranty";
import type { WarrantyLookup } from "../services/warranty-service";
import {
  MESSAGE_TYPES,
  parseExtensionRequest,
  type ExtensionErrorCode,
  type ExtensionResponse,
} from "./messages";

export class WarrantyMessageHandler {
  public constructor(private readonly warrantyLookup: WarrantyLookup) {}

  public async handle(message: unknown): Promise<ExtensionResponse> {
    const request = parseExtensionRequest(message);
    if (request === null) {
      return failure("INVALID_REQUEST");
    }

    try {
      if (request.type === MESSAGE_TYPES.clearWarrantyCache) {
        await this.warrantyLookup.clearCache();
        return { ok: true, type: "CACHE_CLEARED" };
      }

      const result = await this.warrantyLookup.getWarranty(request.serialNumber, {
        forceRefresh: request.forceRefresh,
      });
      return { ok: true, type: "WARRANTY_RESULT", result };
    } catch (error) {
      const warrantyError = normalizeWarrantyError(error);
      return failure(warrantyError.code);
    }
  }
}

function failure(code: ExtensionErrorCode): ExtensionResponse {
  return {
    ok: false,
    error: {
      code,
      message: publicErrorMessage(code),
    },
  };
}

function publicErrorMessage(code: ExtensionErrorCode): string {
  const messages: Record<ExtensionErrorCode, string> = {
    SERIAL_NOT_FOUND: "Seriennummer nicht gefunden.",
    NO_WARRANTY_DATA: "Keine Garantiedaten vorhanden.",
    NETWORK_ERROR: "Die Garantieinformationen konnten nicht übertragen werden.",
    SERVICE_UNAVAILABLE: "Der Garantiedienst ist momentan nicht verfügbar.",
    PERMISSION_DENIED: "Der Zugriff auf die Garantieinformationen wurde abgelehnt.",
    UNKNOWN_ERROR: "Die Garantieinformationen konnten nicht geladen werden.",
    INVALID_REQUEST: "Die Extension-Anfrage ist ungültig.",
    RUNTIME_ERROR: "Die Extension-Kommunikation ist fehlgeschlagen.",
  };
  return messages[code];
}
