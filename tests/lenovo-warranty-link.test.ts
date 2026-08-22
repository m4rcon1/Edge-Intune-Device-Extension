import { describe, expect, it } from "vitest";
import { createLenovoWarrantyUrl } from "../src/lenovo/lenovo-warranty-link";

describe("createLenovoWarrantyUrl", () => {
  it("erzeugt den kurzen ch/de-Deep-Link auf dem festen HTTPS-Host", () => {
    expect(createLenovoWarrantyUrl("PF123ABC")).toBe(
      "https://pcsupport.lenovo.com/ch/de/products/PF123ABC/warranty",
    );
  });

  it("URL-encodiert die Seriennummer und erlaubt keine fremde Basis-URL", () => {
    const url = createLenovoWarrantyUrl("PF 12/34?next=https://example.com");

    expect(url).toBe(
      "https://pcsupport.lenovo.com/ch/de/products/PF%2012%2F34%3Fnext%3Dhttps%3A%2F%2Fexample.com/warranty",
    );
    expect(new URL(url).origin).toBe("https://pcsupport.lenovo.com");
  });
});
