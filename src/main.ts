import { LocalStorageWarrantyCache } from "./cache/local-storage-warranty-cache";
import { MockPageController } from "./mock/mock-page-controller";
import { WarrantyService } from "./services/warranty-service";
import "./styles.css";
import { DeviceDecorator } from "./ui/device-decorator";
import { PopoverController } from "./ui/popover-controller";
import { MockWarrantyProvider } from "./warranty/mock-warranty-provider";

const tableBody = requireElement<HTMLTableSectionElement>("#device-table-body");
const filterInput = requireElement<HTMLInputElement>("#device-filter");
const statusElement = requireElement<HTMLElement>("#mock-status");

const provider = new MockWarrantyProvider();
const cache = new LocalStorageWarrantyCache(window.localStorage);
const warrantyService = new WarrantyService(provider, cache);
const popover = new PopoverController(warrantyService);
const page = new MockPageController(tableBody, filterInput, statusElement);
const decorator = new DeviceDecorator(tableBody, popover);

page.start();
decorator.start();

requireElement<HTMLButtonElement>("#clear-cache").addEventListener("click", () => {
  void clearCacheAndReport();
});

window.setInterval(() => {
  const requestCount = document.querySelector("#request-count");
  if (requestCount !== null) {
    requestCount.textContent = String(provider.getTotalRequestCount());
  }
}, 200);

function requireElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (element === null) {
    throw new Error(`Erwartetes Element fehlt: ${selector}`);
  }
  return element;
}

async function clearCacheAndReport(): Promise<void> {
  await warrantyService.clearCache();
  page.setStatus("Der lokale Garantie-Cache wurde geleert.");
}
