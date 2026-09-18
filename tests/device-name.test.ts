import { describe, expect, it } from "vitest";
import { isSupportedDeviceName, parseDeviceName } from "../src/domain/device-name";

describe("parseDeviceName", () => {
  it.each([
    ["NB-PF123ABC", "PF123ABC"],
    ["D-MJ123ABC", "MJ123ABC"],
    ["nb-pf987xyz", "PF987XYZ"],
    ["  NB-ABC123  ", "ABC123"],
  ])("extrahiert die Seriennummer aus %s", (deviceName, serialNumber) => {
    expect(parseDeviceName(deviceName)).toEqual({
      deviceName: deviceName.trim(),
      serialNumber,
    });
  });

  it.each([
    "",
    "NB-",
    "D-",
    "PC-MJ123ABC",
    "L-MJ123ABC",
    "NBMJ123ABC",
    "D_MJ123ABC",
    "MJ123ABC",
    "DESKTOP-PF123ABC",
    "NB-PF-123",
    "NB-PF 123",
    "NB-PF_123",
  ])("lehnt den ungültigen Gerätenamen %s ab", (deviceName) => {
    expect(parseDeviceName(deviceName)).toBeNull();
    expect(isSupportedDeviceName(deviceName)).toBe(false);
  });
});
