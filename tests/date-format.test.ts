import { describe, expect, it } from "vitest";
import { formatDateOnly, formatDateTime } from "../src/ui/date-format";

describe("Datumsformatierung", () => {
  it("formatiert ein gültiges ISO-Datum ohne Zeitzonenverschiebung", () => {
    expect(formatDateOnly("2026-09-05", "de-CH")).toBe("05.09.2026");
  });

  it("gibt ungültige oder unbekannte Datumswerte unverändert zurück", () => {
    expect(formatDateOnly("2026-02-30", "de-CH")).toBe("2026-02-30");
    expect(formatDateOnly("unbekannt", "de-CH")).toBe("unbekannt");
    expect(formatDateTime("unbekannt", "de-CH")).toBe("unbekannt");
  });
});
