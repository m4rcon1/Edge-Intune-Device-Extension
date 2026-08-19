import type { WarrantyErrorCode, WarrantyInfo } from "../domain/warranty";

export interface CachedWarrantySuccess {
  kind: "success";
  warranty: WarrantyInfo;
}

export interface CachedWarrantyFailure {
  kind: "failure";
  errorCode: Extract<WarrantyErrorCode, "SERIAL_NOT_FOUND" | "NO_WARRANTY_DATA">;
  message: string;
}

export type CachedWarrantyValue = CachedWarrantySuccess | CachedWarrantyFailure;

export interface WarrantyCacheEntry {
  value: CachedWarrantyValue;
  cachedAt: string;
  expiresAt: string;
}

export interface WarrantyCache {
  get(serialNumber: string): Promise<WarrantyCacheEntry | null>;
  set(serialNumber: string, entry: WarrantyCacheEntry): Promise<void>;
  delete(serialNumber: string): Promise<void>;
  clear(): Promise<void>;
}
