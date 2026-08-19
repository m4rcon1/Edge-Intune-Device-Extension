import type { WarrantyCache, WarrantyCacheEntry } from "../cache/warranty-cache";
import { WarrantyError, normalizeWarrantyError, type WarrantyInfo } from "../domain/warranty";
import type { WarrantyProvider } from "../warranty/warranty-provider";

export const CACHE_DURATIONS = {
  successfulResultMilliseconds: 7 * 24 * 60 * 60 * 1000,
  negativeResultMilliseconds: 24 * 60 * 60 * 1000,
} as const;

export interface WarrantyLookupOptions {
  forceRefresh?: boolean;
  signal?: AbortSignal;
}

export interface WarrantyLookupResult {
  warranty: WarrantyInfo;
  fromCache: boolean;
  cachedAt: string;
}

export interface WarrantyLookup {
  getWarranty(serialNumber: string, options?: WarrantyLookupOptions): Promise<WarrantyLookupResult>;
  clearCache(): Promise<void>;
}

export class WarrantyService implements WarrantyLookup {
  readonly #requestsInProgress = new Map<string, Promise<WarrantyLookupResult>>();

  public constructor(
    private readonly provider: WarrantyProvider,
    private readonly cache: WarrantyCache,
    private readonly now: () => Date = () => new Date(),
  ) {}

  public async getWarranty(
    serialNumber: string,
    options: WarrantyLookupOptions = {},
  ): Promise<WarrantyLookupResult> {
    const normalizedSerialNumber = serialNumber.toUpperCase();

    if (options.forceRefresh !== true) {
      const cachedResult = await this.readCache(normalizedSerialNumber);
      if (cachedResult !== null) {
        return cachedResult;
      }

      const activeRequest = this.#requestsInProgress.get(normalizedSerialNumber);
      if (activeRequest !== undefined) {
        return activeRequest;
      }
    }

    const request = this.loadFromProvider(normalizedSerialNumber, options.signal);
    this.#requestsInProgress.set(normalizedSerialNumber, request);

    try {
      return await request;
    } finally {
      if (this.#requestsInProgress.get(normalizedSerialNumber) === request) {
        this.#requestsInProgress.delete(normalizedSerialNumber);
      }
    }
  }

  public async clearCache(): Promise<void> {
    await this.cache.clear();
  }

  private async readCache(serialNumber: string): Promise<WarrantyLookupResult | null> {
    const entry = await this.cache.get(serialNumber);
    if (entry === null) {
      return null;
    }

    if (entry.value.kind === "failure") {
      throw new WarrantyError(entry.value.errorCode, entry.value.message);
    }

    return {
      warranty: entry.value.warranty,
      fromCache: true,
      cachedAt: entry.cachedAt,
    };
  }

  private async loadFromProvider(
    serialNumber: string,
    signal?: AbortSignal,
  ): Promise<WarrantyLookupResult> {
    try {
      const providerOptions = signal === undefined ? undefined : { signal };
      const warranty = await this.provider.getWarranty(serialNumber, providerOptions);
      const entry = this.createCacheEntry(
        { kind: "success", warranty },
        CACHE_DURATIONS.successfulResultMilliseconds,
      );
      await this.cache.set(serialNumber, entry);

      return {
        warranty,
        fromCache: false,
        cachedAt: entry.cachedAt,
      };
    } catch (error) {
      if (signal?.aborted === true) {
        throw error;
      }

      const warrantyError = normalizeWarrantyError(error);
      if (warrantyError.code === "SERIAL_NOT_FOUND" || warrantyError.code === "NO_WARRANTY_DATA") {
        const entry = this.createCacheEntry(
          {
            kind: "failure",
            errorCode: warrantyError.code,
            message: warrantyError.message,
          },
          CACHE_DURATIONS.negativeResultMilliseconds,
        );
        await this.cache.set(serialNumber, entry);
      }

      throw warrantyError;
    }
  }

  private createCacheEntry(
    value: WarrantyCacheEntry["value"],
    durationMilliseconds: number,
  ): WarrantyCacheEntry {
    const cachedAt = this.now();
    const expiresAt = new Date(cachedAt.getTime() + durationMilliseconds);

    return {
      value,
      cachedAt: cachedAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
    };
  }
}
