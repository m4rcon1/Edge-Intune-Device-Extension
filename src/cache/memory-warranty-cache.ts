import type { WarrantyCache, WarrantyCacheEntry } from "./warranty-cache";

export class MemoryWarrantyCache implements WarrantyCache {
  readonly #entries = new Map<string, WarrantyCacheEntry>();

  public constructor(private readonly now: () => Date = () => new Date()) {}

  public async get(serialNumber: string): Promise<WarrantyCacheEntry | null> {
    const key = normalizeKey(serialNumber);
    const entry = this.#entries.get(key);

    if (entry === undefined) {
      return null;
    }

    if (Date.parse(entry.expiresAt) <= this.now().getTime()) {
      this.#entries.delete(key);
      return null;
    }

    return structuredClone(entry);
  }

  public async set(serialNumber: string, entry: WarrantyCacheEntry): Promise<void> {
    this.#entries.set(normalizeKey(serialNumber), structuredClone(entry));
  }

  public async delete(serialNumber: string): Promise<void> {
    this.#entries.delete(normalizeKey(serialNumber));
  }

  public async clear(): Promise<void> {
    this.#entries.clear();
  }
}

function normalizeKey(serialNumber: string): string {
  return serialNumber.toUpperCase();
}
