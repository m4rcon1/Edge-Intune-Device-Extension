import type { WarrantyCache, WarrantyCacheEntry } from "./warranty-cache";

interface StoredEntries {
  [serialNumber: string]: WarrantyCacheEntry;
}

export class LocalStorageWarrantyCache implements WarrantyCache {
  public constructor(
    private readonly storage: Storage,
    private readonly now: () => Date = () => new Date(),
    private readonly storageKey = "edge-intune-warranty-mock-cache-v1",
  ) {}

  public async get(serialNumber: string): Promise<WarrantyCacheEntry | null> {
    const entries = this.readEntries();
    const key = normalizeKey(serialNumber);
    const entry = entries[key];

    if (entry === undefined) {
      return null;
    }

    if (Date.parse(entry.expiresAt) <= this.now().getTime()) {
      delete entries[key];
      this.writeEntries(entries);
      return null;
    }

    return structuredClone(entry);
  }

  public async set(serialNumber: string, entry: WarrantyCacheEntry): Promise<void> {
    const entries = this.readEntries();
    entries[normalizeKey(serialNumber)] = structuredClone(entry);
    this.writeEntries(entries);
  }

  public async delete(serialNumber: string): Promise<void> {
    const entries = this.readEntries();
    delete entries[normalizeKey(serialNumber)];
    this.writeEntries(entries);
  }

  public async clear(): Promise<void> {
    this.storage.removeItem(this.storageKey);
  }

  private readEntries(): StoredEntries {
    const serializedEntries = this.storage.getItem(this.storageKey);
    if (serializedEntries === null) {
      return {};
    }

    try {
      const parsedEntries: unknown = JSON.parse(serializedEntries);
      return isRecord(parsedEntries) ? (parsedEntries as StoredEntries) : {};
    } catch {
      this.storage.removeItem(this.storageKey);
      return {};
    }
  }

  private writeEntries(entries: StoredEntries): void {
    this.storage.setItem(this.storageKey, JSON.stringify(entries));
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeKey(serialNumber: string): string {
  return serialNumber.toUpperCase();
}
