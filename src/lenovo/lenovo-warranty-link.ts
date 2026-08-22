import { LENOVO_WEB_CONFIG } from "./lenovo-web-config";

export function createLenovoWarrantyUrl(serialNumber: string): string {
  const encodedSerialNumber = encodeURIComponent(serialNumber);
  return (
    `${LENOVO_WEB_CONFIG.origin}/${LENOVO_WEB_CONFIG.country}/${LENOVO_WEB_CONFIG.language}` +
    `/products/${encodedSerialNumber}/warranty`
  );
}
