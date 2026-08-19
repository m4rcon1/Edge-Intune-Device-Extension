import { describe, expect, it } from "vitest";
import { isSupportedDeviceName, parseDeviceName } from "../src/domain/device-name";

describe("parseDeviceName", () => {
  it.each([
    ["NB-PF123ABC", "PF123ABC"],
    ["nb-pf987xyz", "PF987XYZ"],
    ["  NB-ABC123  ", "ABC123"],
  ])("extrahiert die Seriennummer aus %s", (deviceName, serialNumber) => {
    expect(parseDeviceName(deviceName)).toEqual({
      deviceName: deviceName.trim(),
      serialNumber,
    });
  });

  it.each(["", "NB-", "DESKTOP-PF123ABC", "NB-PF-123", "NB-PF 123", "NB-PF_123"])(
    "lehnt den ungültigen Gerätenamen %s ab",
    (deviceName) => {
      expect(parseDeviceName(deviceName)).toBeNull();
      expect(isSupportedDeviceName(deviceName)).toBe(false);
    },
  );
});
