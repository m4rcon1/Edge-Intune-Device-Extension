import { describe, expect, it } from "vitest";
import {
  MESSAGE_TYPES,
  parseExtensionRequest,
  parseExtensionResponse,
} from "../src/messaging/messages";

describe("Extension-Messaging-Validierung", () => {
  it("akzeptiert und normalisiert eine gültige Garantieanfrage", () => {
    expect(
      parseExtensionRequest({
        type: MESSAGE_TYPES.getWarranty,
        serialNumber: "pf123abc",
        forceRefresh: false,
      }),
    ).toEqual({
      type: MESSAGE_TYPES.getWarranty,
      serialNumber: "PF123ABC",
      forceRefresh: false,
    });
  });

  it.each([
    null,
    {},
    { type: "UNKNOWN" },
    { type: MESSAGE_TYPES.getWarranty, serialNumber: "PF-123", forceRefresh: false },
    { type: MESSAGE_TYPES.getWarranty, serialNumber: "PF123ABC", forceRefresh: "false" },
  ])("lehnt eine ungültige Nachricht ab", (message) => {
    expect(parseExtensionRequest(message)).toBeNull();
  });

  it("lehnt eine unstrukturierte Response ab", () => {
    expect(parseExtensionResponse({ ok: true, type: "WARRANTY_RESULT", result: {} })).toBeNull();
    expect(parseExtensionResponse({ ok: false, error: { code: "INTERNAL_SECRET" } })).toBeNull();
  });
});
