export interface WarrantyCoverage {
  warrantyType: string;
  coverageStartDate?: string;
  coverageEndDate?: string;
}

export interface WarrantyInfo {
  serialNumber: string;
  coverages: WarrantyCoverage[];
  checkedAt: string;
}

export const WARRANTY_ERROR_CODES = [
  "SERIAL_NOT_FOUND",
  "NO_WARRANTY_DATA",
  "NETWORK_ERROR",
  "SERVICE_UNAVAILABLE",
  "PERMISSION_DENIED",
  "UNKNOWN_ERROR",
] as const;

export type WarrantyErrorCode = (typeof WARRANTY_ERROR_CODES)[number];

export class WarrantyError extends Error {
  public constructor(
    public readonly code: WarrantyErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "WarrantyError";
  }
}

export function normalizeWarrantyError(error: unknown): WarrantyError {
  if (error instanceof WarrantyError) {
    return error;
  }

  return new WarrantyError(
    "UNKNOWN_ERROR",
    "Die Garantieinformationen konnten nicht geladen werden.",
    {
      cause: error,
    },
  );
}
