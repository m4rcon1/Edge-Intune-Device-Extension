import type { ExtensionStorageArea } from "../../src/cache/chrome-storage-warranty-cache";

export class FakeExtensionStorage implements ExtensionStorageArea {
  readonly #values: Record<string, unknown> = {};

  public async get(keys: string | string[] | null): Promise<Record<string, unknown>> {
    if (keys === null) {
      return structuredClone(this.#values);
    }

    const requestedKeys = Array.isArray(keys) ? keys : [keys];
    return Object.fromEntries(
      requestedKeys
        .filter((key) => key in this.#values)
        .map((key) => [key, structuredClone(this.#values[key])]),
    );
  }

  public async set(items: Record<string, unknown>): Promise<void> {
    for (const [key, value] of Object.entries(items)) {
      this.#values[key] = structuredClone(value);
    }
  }

  public async remove(keys: string | string[]): Promise<void> {
    for (const key of Array.isArray(keys) ? keys : [keys]) {
      delete this.#values[key];
    }
  }

  public read(key: string): unknown {
    return this.#values[key];
  }
}
