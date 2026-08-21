import { describe, expect, it } from "vitest";
import manifestJson from "../manifest/manifest.json";

interface ExtensionManifest {
  manifest_version?: number;
  permissions?: string[];
  host_permissions?: string[];
  background?: { service_worker?: string; type?: string };
  content_scripts?: Array<{ matches?: string[]; js?: string[]; css?: string[] }>;
}

describe("Manifest V3", () => {
  it("verwendet nur die minimal erforderlichen lokalen Berechtigungen", async () => {
    const manifest = manifestJson as ExtensionManifest;

    expect(manifest.manifest_version).toBe(3);
    expect(manifest.permissions).toEqual(["storage"]);
    expect(manifest.host_permissions).toBeUndefined();
    expect(manifest.background).toEqual({ service_worker: "background.js", type: "module" });
    expect(manifest.content_scripts).toEqual([
      expect.objectContaining({
        matches: ["http://127.0.0.1:4173/*"],
        js: ["content.js"],
        css: ["content.css"],
      }),
    ]);
  });
});
