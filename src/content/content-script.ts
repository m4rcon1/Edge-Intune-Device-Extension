import "./content.css";
import { RuntimeWarrantyLookup } from "./runtime-warranty-lookup";
import { DeviceDecorator } from "../ui/device-decorator";
import { IntuneDeviceListAdapter, isTrustedIntuneReferrer } from "../ui/intune-device-list-adapter";
import { MockDeviceListAdapter } from "../ui/mock-device-list-adapter";
import { PopoverController } from "../ui/popover-controller";

const MOCK_PAGE_MARKER = "warrantyExtensionMock";

if (document.body.dataset[MOCK_PAGE_MARKER] === "true") {
  const tableBody = document.querySelector<HTMLTableSectionElement>("#device-table-body");
  if (tableBody !== null) {
    const lookup = new RuntimeWarrantyLookup(chrome.runtime);
    const popover = new PopoverController(lookup);
    const decorator = new DeviceDecorator(new MockDeviceListAdapter(tableBody), popover);
    decorator.start();

    const clearCacheButton = document.querySelector<HTMLButtonElement>("#clear-cache");
    clearCacheButton?.addEventListener("click", () => void clearCache(lookup));
    updatePageStatus("Extension aktiv. Wähle ein Informationssymbol neben einem NB-Gerät.");
  }
} else if (isTrustedIntuneReferrer(document.referrer)) {
  const lookup = new RuntimeWarrantyLookup(chrome.runtime);
  const popover = new PopoverController(lookup);
  const decorator = new DeviceDecorator(new IntuneDeviceListAdapter(document), popover);
  decorator.start();
}

async function clearCache(lookup: RuntimeWarrantyLookup): Promise<void> {
  try {
    await lookup.clearCache();
    updatePageStatus("Der zentrale Extension-Cache wurde geleert.");
  } catch {
    updatePageStatus("Der Extension-Cache konnte nicht geleert werden.");
  }
}

function updatePageStatus(message: string): void {
  const statusElement = document.querySelector("#mock-status");
  if (statusElement !== null) {
    statusElement.textContent = message;
  }
}
