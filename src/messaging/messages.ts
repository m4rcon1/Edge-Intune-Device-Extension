import { normalizeSerialNumber } from "../domain/device-name";
import type { WarrantyErrorCode } from "../domain/warranty";
import type { WarrantyLookupResult } from "../services/warranty-service";

export const MESSAGE_TYPES = {
  getWarranty: "GET_WARRANTY",
  clearWarrantyCache: "CLEAR_WARRANTY_CACHE",
} as const;

export interface GetWarrantyMessage {
  type: typeof MESSAGE_TYPES.getWarranty;
  serialNumber: string;
  forceRefresh: boolean;
}

export interface ClearWarrantyCacheMessage {
  type: typeof MESSAGE_TYPES.clearWarrantyCache;
}

export type ExtensionRequest = GetWarrantyMessage | ClearWarrantyCacheMessage;

export type ExtensionErrorCode = WarrantyErrorCode | "INVALID_REQUEST" | "RUNTIME_ERROR";

export interface ExtensionErrorResponse {
  ok: false;
  error: {
    code: ExtensionErrorCode;
    message: string;
  };
}

export interface WarrantySuccessResponse {
  ok: true;
  type: "WARRANTY_RESULT";
  result: WarrantyLookupResult;
}

export interface CacheClearedResponse {
  ok: true;
  type: "CACHE_CLEARED";
}

export type ExtensionResponse =
  WarrantySuccessResponse | CacheClearedResponse | ExtensionErrorResponse;

export function parseExtensionRequest(value: unknown): ExtensionRequest | null {
  if (!isRecord(value) || typeof value.type !== "string") {
    return null;
  }

  if (value.type === MESSAGE_TYPES.clearWarrantyCache) {
    return { type: MESSAGE_TYPES.clearWarrantyCache };
  }

  if (
    value.type === MESSAGE_TYPES.getWarranty &&
    typeof value.serialNumber === "string" &&
    typeof value.forceRefresh === "boolean"
  ) {
    const serialNumber = normalizeSerialNumber(value.serialNumber);
    if (serialNumber !== null) {
      return {
        type: MESSAGE_TYPES.getWarranty,
        serialNumber,
        forceRefresh: value.forceRefresh,
      };
    }
  }

  return null;
}

export function parseExtensionResponse(value: unknown): ExtensionResponse | null {
  if (!isRecord(value) || typeof value.ok !== "boolean") {
    return null;
  }

  if (value.ok === false) {
    if (!isRecord(value.error) || !isExtensionErrorCode(value.error.code)) {
      return null;
    }
    return typeof value.error.message === "string"
      ? { ok: false, error: { code: value.error.code, message: value.error.message } }
      : null;
  }

  if (value.type === "CACHE_CLEARED") {
    return { ok: true, type: "CACHE_CLEARED" };
  }

  if (value.type === "WARRANTY_RESULT" && isWarrantyLookupResult(value.result)) {
    return { ok: true, type: "WARRANTY_RESULT", result: value.result };
  }

  return null;
}

function isWarrantyLookupResult(value: unknown): value is WarrantyLookupResult {
  if (
    !isRecord(value) ||
    typeof value.fromCache !== "boolean" ||
    typeof value.cachedAt !== "string" ||
    !isRecord(value.warranty)
  ) {
    return false;
  }

  return (
    typeof value.warranty.serialNumber === "string" &&
    typeof value.warranty.checkedAt === "string" &&
    Array.isArray(value.warranty.coverages)
  );
}

function isExtensionErrorCode(value: unknown): value is ExtensionErrorCode {
  return (
    typeof value === "string" &&
    [
      "SERIAL_NOT_FOUND",
      "NO_WARRANTY_DATA",
      "NETWORK_ERROR",
      "SERVICE_UNAVAILABLE",
      "PERMISSION_DENIED",
      "UNKNOWN_ERROR",
      "INVALID_REQUEST",
      "RUNTIME_ERROR",
    ].includes(value)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
