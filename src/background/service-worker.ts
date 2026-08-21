import { ChromeStorageWarrantyCache } from "../cache/chrome-storage-warranty-cache";
import { WarrantyMessageHandler } from "../messaging/warranty-message-handler";
import { WarrantyService } from "../services/warranty-service";
import { MockWarrantyProvider } from "../warranty/mock-warranty-provider";

const cache = new ChromeStorageWarrantyCache(chrome.storage.local);
const warrantyService = new WarrantyService(new MockWarrantyProvider(), cache);
const messageHandler = new WarrantyMessageHandler(warrantyService);

void restrictStorageToTrustedContexts();

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id) {
    sendResponse({
      ok: false,
      error: { code: "INVALID_REQUEST", message: "Unzulässiger Absender." },
    });
    return false;
  }

  void messageHandler.handle(message).then(sendResponse);
  return true;
});

async function restrictStorageToTrustedContexts(): Promise<void> {
  try {
    await chrome.storage.local.setAccessLevel({ accessLevel: "TRUSTED_CONTEXTS" });
  } catch {
    // Der Cache bleibt funktionsfähig; das Content Script greift trotzdem nie direkt darauf zu.
  }
}
