import { describe, expect, it } from "vitest";
import { isLocalMockPageUrl } from "../src/background/warranty-source";

describe("isLocalMockPageUrl", () => {
  it("erkennt ausschliesslich den festgelegten lokalen Mock-Origin", () => {
    expect(isLocalMockPageUrl("http://127.0.0.1:4173/")).toBe(true);
    expect(isLocalMockPageUrl("http://127.0.0.1:4173/details")).toBe(true);
    expect(isLocalMockPageUrl("http://localhost:4173/")).toBe(false);
    expect(isLocalMockPageUrl("https://127.0.0.1:4173/")).toBe(false);
    expect(isLocalMockPageUrl("https://example.com/?url=http://127.0.0.1:4173")).toBe(false);
    expect(isLocalMockPageUrl(undefined)).toBe(false);
  });
});
