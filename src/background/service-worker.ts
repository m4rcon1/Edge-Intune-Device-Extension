import {
  ChromeStorageWarrantyCache,
  WARRANTY_CACHE_NAMESPACES,
} from "../cache/chrome-storage-warranty-cache";
import { WarrantyMessageHandler } from "../messaging/warranty-message-handler";
import { WarrantyService } from "../services/warranty-service";
import { LenovoWebWarrantyProvider } from "../warranty/lenovo-web-warranty-provider";
import { MockWarrantyProvider } from "../warranty/mock-warranty-provider";
import { isLocalMockPageUrl } from "./warranty-source";

const mockCache = new ChromeStorageWarrantyCache(chrome.storage.local);
const lenovoCache = new ChromeStorageWarrantyCache(
  chrome.storage.local,
  () => new Date(),
  WARRANTY_CACHE_NAMESPACES.lenovoWeb,
);
const mockMessageHandler = new WarrantyMessageHandler(
  new WarrantyService(new MockWarrantyProvider(), mockCache),
);
const lenovoMessageHandler = new WarrantyMessageHandler(
  new WarrantyService(new LenovoWebWarrantyProvider(), lenovoCache),
);

void restrictStorageToTrustedContexts();

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id) {
    sendResponse({
      ok: false,
      error: { code: "INVALID_REQUEST", message: "Unzulässiger Absender." },
    });
    return false;
  }

  const messageHandler = isLocalMockPageUrl(sender.url) ? mockMessageHandler : lenovoMessageHandler;
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
