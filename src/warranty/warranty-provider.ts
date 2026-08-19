import type { WarrantyInfo } from "../domain/warranty";

export interface WarrantyRequestOptions {
  signal?: AbortSignal;
}

export interface WarrantyProvider {
  getWarranty(serialNumber: string, options?: WarrantyRequestOptions): Promise<WarrantyInfo>;
}
