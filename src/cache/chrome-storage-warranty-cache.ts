import type { WarrantyCache, WarrantyCacheEntry } from "./warranty-cache";

export interface ExtensionStorageArea {
  get(keys: string | string[] | null): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
  remove(keys: string | string[]): Promise<void>;
}

const CACHE_KEY_PREFIX = "warranty-cache-v1:";

export class ChromeStorageWarrantyCache implements WarrantyCache {
  public constructor(
    private readonly storage: ExtensionStorageArea,
    private readonly now: () => Date = () => new Date(),
  ) {}

  public async get(serialNumber: string): Promise<WarrantyCacheEntry | null> {
    const key = createKey(serialNumber);
    const storedValues = await this.storage.get(key);
    const entry = storedValues[key];

    if (!isWarrantyCacheEntry(entry)) {
      if (entry !== undefined) {
        await this.storage.remove(key);
      }
      return null;
    }

    if (Date.parse(entry.expiresAt) <= this.now().getTime()) {
      await this.storage.remove(key);
      return null;
    }

    return structuredClone(entry);
  }

  public async set(serialNumber: string, entry: WarrantyCacheEntry): Promise<void> {
    await this.storage.set({ [createKey(serialNumber)]: structuredClone(entry) });
  }

  public async delete(serialNumber: string): Promise<void> {
    await this.storage.remove(createKey(serialNumber));
  }

  public async clear(): Promise<void> {
    const storedValues = await this.storage.get(null);
    const cacheKeys = Object.keys(storedValues).filter((key) => key.startsWith(CACHE_KEY_PREFIX));
    if (cacheKeys.length > 0) {
      await this.storage.remove(cacheKeys);
    }
  }
}

function createKey(serialNumber: string): string {
  return `${CACHE_KEY_PREFIX}${serialNumber.toUpperCase()}`;
}

function isWarrantyCacheEntry(value: unknown): value is WarrantyCacheEntry {
  if (
    !isRecord(value) ||
    typeof value.cachedAt !== "string" ||
    typeof value.expiresAt !== "string" ||
    Number.isNaN(Date.parse(value.cachedAt)) ||
    Number.isNaN(Date.parse(value.expiresAt)) ||
    !isRecord(value.value)
  ) {
    return false;
  }

  if (value.value.kind === "failure") {
    return (
      (value.value.errorCode === "SERIAL_NOT_FOUND" ||
        value.value.errorCode === "NO_WARRANTY_DATA") &&
      typeof value.value.message === "string"
    );
  }

  if (value.value.kind !== "success" || !isRecord(value.value.warranty)) {
    return false;
  }

  return (
    typeof value.value.warranty.serialNumber === "string" &&
    typeof value.value.warranty.checkedAt === "string" &&
    Array.isArray(value.value.warranty.coverages)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
