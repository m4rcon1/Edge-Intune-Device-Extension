# Intune Lenovo Warranty Extension

## Overview

This project is a Microsoft Edge extension built with Manifest V3 for the Windows device list in
Microsoft Intune. It adds an information button next to supported Lenovo device names. Warranty
data is requested only when a user selects that button and is displayed in a small popover together
with a direct link to Lenovo's warranty page.

The extension reads the rendered device name from the Intune user interface. It does not use
Microsoft Graph, an Intune API, or a backend service, and it does not modify Intune device data.

## Features

- Detects supported Lenovo notebook and desktop names in the Intune Windows device list.
- Adds exactly one information button next to each supported device.
- Does not contact Lenovo during normal page loading, scrolling, filtering, or navigation.
- Requests warranty data only after explicit user interaction.
- Displays the warranty type, start date, and end date.
- Provides a device-specific link to Lenovo's public warranty page.
- Uses a persistent local cache to reduce external requests and improve response time.
- Supports manual refresh after a successful lookup and retry after an error.
- Handles Intune single-page application navigation and dynamically replaced device lists.
- Handles virtualized rows that Intune reuses for different devices.
- Avoids decorating unrelated or ambiguous Intune lists.
- Presents loading, result, and structured error states in an accessible popover.

## Supported device names

Only these two naming schemes are supported:

```text
NB-<SERIAL_NUMBER>  Lenovo notebook
D-<SERIAL_NUMBER>   Lenovo desktop
```

The value after the prefix must contain only letters and digits. Only that serial-number portion is
sent to Lenovo. Other prefixes and malformed names are intentionally ignored; there is no generic
`<PREFIX>-<SERIAL_NUMBER>` rule.

## How it works

```text
Intune Windows device list
  -> Content Script
  -> device-name validation
  -> user selects the information button
  -> Runtime Message
  -> Background Service Worker
  -> cache lookup
  -> Lenovo Web Warranty Provider on a cache miss
  -> result returned to the popover
```

Matching devices are decorated in the rendered page without changing Intune data. Lenovo is
contacted only when a lookup is necessary. Cached results avoid repeated requests. The Lenovo
deep-link is generated locally from the validated serial number and does not depend on the JSON
lookup succeeding.

## Architecture

- **Content Script** starts the appropriate page integration and connects the UI to extension
  runtime messaging.
- **`IntuneDeviceListAdapter`** identifies one verified Intune device list and observes its
  lifecycle and row changes.
- **`MockDeviceListAdapter`** provides the same adapter contract for the local mock page.
- **`DeviceDecorator`** parses device names and adds, updates, or removes idempotent information
  buttons.
- **`PopoverController`** renders loading, warranty, cache, refresh, link, and error states.
- **`RuntimeWarrantyLookup`** sends validated one-time messages from the content script to the
  background context.
- **Background Service Worker** validates the sender and selects either the production or mock data
  path.
- **`WarrantyProvider`** isolates warranty retrieval behind an interface.
- **`LenovoWebWarrantyProvider`** performs and validates the production Lenovo request.
- **`MockWarrantyProvider`** returns deterministic simulated results for local development.
- **`WarrantyService`** coordinates providers, in-progress requests, and cache policy.
- **`ChromeStorageWarrantyCache`** stores namespaced cache entries in
  `chrome.storage.local`.
- **Domain parsing** in `parseDeviceName` and `normalizeSerialNumber` validates device names
  and serial numbers at trust boundaries.

## Lenovo warranty integration

The production provider sends an HTTPS request to the endpoint used by Lenovo's public support
website:

```text
POST https://pcsupport.lenovo.com/ch/de/api/v4/upsell/redport/getIbaseInfo
```

The JSON request body is:

```json
{
  "serialNumber": "<SERIAL_NUMBER>",
  "country": "ch",
  "language": "de"
}
```

The request uses `credentials: "omit"`. It does not include an authentication token, cookies,
user identity, tenant identifier, or Intune management metadata. The only device-specific value
sent to Lenovo is the validated serial number.

The provider reads `data.currentWarranty` from a successful response:

| Warranty field | Source field                                                  |
| -------------- | ------------------------------------------------------------- |
| Warranty type  | `deliveryTypeName`, with `currentWarranty.name` as a fallback |
| Start date     | `startDate`                                                   |
| End date       | `endDate`                                                     |

Other warranty collections such as `baseWarranties` are not displayed. Responses are validated
and immediately reduced to the extension's warranty domain model.

This endpoint is an **undocumented public web endpoint**, not an officially supported Lenovo API.
Lenovo may change, restrict, or remove it independently of this project.

The popover also provides this locally generated deep-link:

```text
https://pcsupport.lenovo.com/ch/de/products/<serial>/warranty
```

Lenovo redirects that short URL to the canonical product-specific page.

## Cache behavior

The production cache is stored in `chrome.storage.local` and uses the following policy:

| Result                                                          | Retention  |
| --------------------------------------------------------------- | ---------- |
| Successful warranty result                                      | 7 days     |
| Unknown serial number                                           | 24 hours   |
| No warranty data                                                | 24 hours   |
| Network, permission, service, timeout, or response-format error | Not cached |

The cache reduces unnecessary Lenovo requests, improves response time, and preserves results across
browser and service-worker restarts.

The **Refresh** action after a successful lookup and the **Retry** action after an error both start a
force-refresh lookup. That request bypasses reading from the cache. A successful or negative result
is then stored according to the policy above; technical errors are not cached.

## Permissions and host access

The Manifest V3 configuration uses only the following permissions and match patterns:

| Entry                                                                     | Purpose                                                                    |
| ------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `storage`                                                                 | Stores the persistent warranty cache in `chrome.storage.local`.            |
| `https://pcsupport.lenovo.com/*` host permission                          | Allows the background service worker to call the Lenovo warranty endpoint. |
| `http://127.0.0.1:4173/*` content-script match                            | Enables the local mock environment.                                        |
| `https://*.reactblade.portal.azure.net/React/Index*` content-script match | Runs the integration in Intune React Blade frames.                         |
| `all_frames: true`                                                        | Allows the content script to reach the matching cross-origin Intune frame. |

For Intune, the content script additionally requires the exact
`https://intune.microsoft.com` referrer origin and a verified device-list DOM signature before
it decorates anything.

The extension does not request `<all_urls>`, `tabs`, or `webRequest`.

## Privacy and security

- No backend server is used.
- The extension implements no telemetry.
- No Intune tenant identifiers, user identities, compliance information, or device-management
  metadata are sent to Lenovo.
- Only the validated serial number, country code, and language code are sent in a warranty request.
- Lenovo responses are mapped in the background worker and are not persistently stored in raw form.
- Cache entries contain only reduced warranty-domain or normalized negative-result data and cache
  timestamps.
- Production source code does not log serial numbers or raw Lenovo responses.
- Runtime requests and responses are structurally validated.
- External Lenovo values are rendered as text rather than injected as HTML.
- The Lenovo link opens with `noopener noreferrer`.

## Build and local installation

### Prerequisites

- Node.js 20 or later
- npm
- A current Microsoft Edge version for loading the unpacked extension

Install the locked dependencies:

```bash
npm ci
```

Run the complete project validation:

```bash
npm run check
```

The check command runs, in order:

1. Prettier formatting validation
2. TypeScript type checking
3. ESLint
4. Vitest
5. The production build

Build the extension separately with:

```bash
npm run build
```

The build recreates `dist/` and writes the manifest, content-script bundle and styles, and
background service-worker bundle there.

To load the extension locally in Edge:

1. Open `edge://extensions`.
2. Enable **Developer mode**.
3. Select **Load unpacked** / **Entpackte Erweiterung laden**.
4. Select the generated `dist/` directory.
5. After every rebuild, reload the extension and then reload the Intune page.

## Local mock environment

The repository includes a local device-list page for deterministic development without Intune or
Lenovo access. Start the development environment with:

```bash
npm run dev
```

This command:

- watches and rebuilds the extension into `dist/`;
- builds the mock page separately into `.dev/`;
- serves the page at [http://127.0.0.1:4173](http://127.0.0.1:4173).

Load `dist/` as an unpacked extension and then open the local URL. Requests originating from
that page are routed to `MockWarrantyProvider`, which returns simulated data and errors. The
mock path does not contact Lenovo. It also provides controls for filtering, sorting, replacing and
reusing rows, refreshing results, and clearing the mock cache.

Restart `npm run dev` after changing `manifest/manifest.json` or `mock/index.html`.

## Tests

The automated test suite uses Vitest with jsdom. TypeScript is configured in strict mode, and the
quality pipeline also includes ESLint, Prettier, and a complete esbuild production build.

Tests cover:

- device-name and serial-number parsing, including the `NB-` and `D-` prefixes;
- decoration, idempotency, and removal for invalid devices;
- Intune device-list detection and rejection of unrelated or ambiguous lists;
- single-page application lifecycle changes, row replacement, and row recycling;
- cache hits, expiry, namespace separation, negative caching, and force refresh;
- runtime message validation and error propagation;
- Lenovo request construction, response parsing, timeout, HTTP error mapping, and schema errors;
- popover state and stale-response handling;
- Lenovo deep-link generation.

Automated tests inject simulated providers, storage, runtime messaging, and fetch behavior. They do
not send real Lenovo network requests.

Run all tests with:

```bash
npm test
```

Use `npm run test:watch` during development.

## Error handling

The popover presents a specific user-facing state for the main failure categories and provides a
retry action:

| Condition                                             | Behavior                                                     |
| ----------------------------------------------------- | ------------------------------------------------------------ |
| Serial number not found                               | Displays a not-found message; cached for 24 hours.           |
| No warranty data                                      | Displays a no-data message; cached for 24 hours.             |
| Network failure                                       | Displays a network error; not cached.                        |
| HTTP 401 or 403                                       | Displays an access-denied error; not cached.                 |
| HTTP 429 or 5xx                                       | Displays a service-unavailable error; not cached.            |
| Invalid JSON, unexpected status, or unexpected schema | Displays a technical error; not cached.                      |
| Request exceeds 10 seconds                            | Aborts the request and displays a network error; not cached. |

The Lenovo deep-link remains available in loading, result, and error states.

## Intune integration assumptions

Microsoft Intune is a single-page application. Its device list and containing React Blade can be
replaced dynamically, and list rows can be virtualized and reused for different devices.

The extension observes those lifecycle changes and revalidates the active list. It relies on the
current Intune React Blade host pattern and a narrow set of semantic ARIA and `data-*`
attributes that identify the Windows device-name column and cells. It changes nothing if that
signature is absent or ambiguous.

These DOM details are not a public Microsoft API contract. Future Intune changes may require an
adapter update.

## Maintenance

The main external compatibility points are:

- **Microsoft Intune:** the React Blade host or device-list DOM structure may change.
- **Lenovo:** the undocumented warranty endpoint, response schema, access policy, or availability
  may change.
- **Microsoft Edge / Chromium:** Manifest V3 content-script, service-worker, messaging, storage, or
  cross-origin behavior may change.

If information buttons disappear, verify the Intune host and DOM integration first. If buttons
remain but lookups fail, inspect the background service worker, Lenovo connectivity, HTTP status,
and response schema. The background service worker is intentionally short-lived; a dormant worker
is expected and is restarted by runtime messaging.

## Troubleshooting

### No information button is visible

- Confirm that the device name matches `NB-<SERIAL_NUMBER>` or `D-<SERIAL_NUMBER>`.
- Confirm that the current page is the Intune Windows device list.
- Check that the content-script URL pattern still matches the active React Blade frame.
- Check for an Intune DOM change that prevents the device-list signature from being verified.

### The popover opens but the warranty lookup fails

- Check whether `pcsupport.lenovo.com` is reachable.
- Verify the Lenovo host permission in the built manifest.
- Inspect the extension's background service worker in `edge://extensions`.
- Check the request status and whether Lenovo changed the endpoint or response schema.

### The deep-link works but the lookup fails

The deep-link is generated locally and is independent of the JSON lookup. This usually indicates a
problem in the provider, network, permission, endpoint, or response-parsing path rather than
device-name parsing.

### Extension changes are not visible

- Run a fresh `npm run build`.
- Confirm that Edge is loading the expected `dist/` directory.
- Reload the extension on `edge://extensions`.
- Reload the Intune page after reloading the extension.

## Deployment

Production distribution is intended through Microsoft Edge Add-ons, followed by enterprise
deployment through Microsoft Intune. Store submission and Intune policy configuration are outside
the scope of this repository documentation.
