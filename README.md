# Edge Intune Device Extension – Phase 4B

Die Manifest-V3-Extension ergänzt sowohl die lokale Mock-Seite als auch die echte
Windows-Geräteliste im Microsoft Intune Admin Center. Sie zeigt Garantieinformationen über den
bestehenden Background Service Worker an; sämtliche Garantiedaten bleiben simuliert.

Es bestehen keine Verbindungen zu Lenovo, Microsoft Graph, Intune-APIs, einem Backend oder anderen
externen Datendiensten. In Intune wird ausschliesslich der gerenderte Gerätename gelesen. Die
Extension führt keine schreibenden Intune-Aktionen aus.

## Architektur

```text
Lokale Mock-Seite ── MockDeviceListAdapter ─┐
                                            ├── DeviceDecorator und Popover
Intune React-Blade ─ IntuneDeviceListAdapter┘             │
                                                          │ chrome.runtime Messaging
                                                          ▼
                                               Background Service Worker
                                               ├── WarrantyService
                                               ├── MockWarrantyProvider
                                               └── chrome.storage.local
```

Die Mock-Webseite lädt nur ihren eigenen Tabellen- und Simulationscode. Sie importiert keinen
Extension-Code. Informationssymbole, Popover und Garantieabfragen funktionieren deshalb nur,
wenn die gebaute Extension tatsächlich im Browser geladen ist.

## Funktionsumfang

- Erkennung von Gerätenamen nach `NB-[Seriennummer]`
- sprachunabhängige, fail-closed Erkennung der echten Intune-DetailsList
- idempotente Informationssymbole, auch bei dynamischen und wiederverwendeten Zeilen
- Popover mit Lade-, Erfolgs- und strukturierten Fehlerzuständen
- Schliessen per erneutem Klick, Aussenklick, Schliessschaltfläche oder `Escape`
- typsichere Einmal-Nachrichten zwischen Content Script und Service Worker
- Validierung aller eingehenden Nachrichten und Seriennummern
- erfolgreicher Cache für sieben Tage
- negativer Cache für „nicht gefunden“ und „keine Daten“ für 24 Stunden
- kein Cache für technische Fehler
- manueller Refresh und Cache-Löschung
- persistenter Extension-Cache mit `chrome.storage.local`

## Voraussetzungen

- Node.js 20 oder neuer
- npm
- aktuelles Microsoft Edge auf Windows oder ein aktueller Chromium-basierter Browser

Versionen prüfen:

```bash
node --version
npm --version
```

## Installation

Nach einem frischen Checkout im Projektordner:

```bash
npm ci
```

`npm ci` installiert exakt die Versionen aus `package-lock.json`. Der Befehl ersetzt einen
vorhandenen `node_modules`-Ordner und installiert keine globalen Werkzeuge.

## Extension bauen

```bash
npm run build
```

Der Befehl erzeugt im ignorierten Ordner `dist/` eine vollständig lokal ladbare Extension:

```text
dist/
├── manifest.json
├── background.js
├── background.js.map
├── content.js
├── content.js.map
├── content.css
└── content.css.map
```

Der Build enthält keine Mock-Webseite und keinen Remote-Code.

## Lokaler Extension-Test

### 1. Entwicklungsserver und Extension-Watch-Build starten

```bash
npm run dev
```

Der Befehl:

- baut die Extension nach `dist/`,
- beobachtet TypeScript- und CSS-Dateien auf Änderungen,
- baut die Mock-Webseite separat nach `.dev/`,
- stellt sie unter [http://127.0.0.1:4173](http://127.0.0.1:4173) bereit.

Nach Änderungen an `manifest/manifest.json` oder `mock/index.html` muss der Entwicklungsserver
neu gestartet werden. Beenden: `Ctrl+C`.

### 2. Extension in Edge laden

1. `edge://extensions` öffnen.
2. **Entwicklermodus** aktivieren.
3. **Entpackte Erweiterung laden** auswählen.
4. Den Projektordner `dist/` auswählen.
5. Prüfen, dass „Intune Lenovo Warranty Prototype“ ohne Fehler angezeigt wird.

Unter Chromium lautet die Verwaltungsadresse entsprechend `chrome://extensions`.

### 3. Mock-Seite öffnen

1. [http://127.0.0.1:4173](http://127.0.0.1:4173) öffnen oder neu laden.
2. Neben gültigen `NB-…`-Geräten müssen Informationssymbole erscheinen.
3. Ein Symbol auswählen und Ladezustand sowie Garantieinformationen prüfen.
4. Fehlerfälle mit `PF404404`, `PF000000`, `PFNETWORK`, `PFOFFLINE` und `PFDENIED` prüfen.
5. **Tabelle neu laden** und **Zeile wiederverwenden** betätigen; es dürfen keine doppelten oder
   falsch zugeordneten Symbole entstehen.
6. **Neu laden** im Popover testen; dadurch wird der Cache umgangen.
7. **Cache leeren** betätigen und die Statusmeldung prüfen.

### 4. Extension nach Codeänderungen neu laden

Der Watch-Build aktualisiert die Dateien in `dist/`, aber Edge lädt eine installierte Extension
nicht automatisch neu:

1. Auf `edge://extensions` bei der Extension **Neu laden** auswählen.
2. Danach die Mock-Seite neu laden.

## Manueller Intune-Test unter Edge

### Voraussetzungen

- Microsoft Edge mit aktiviertem Entwicklermodus
- berechtigter Intune-Testaccount
- für Entwicklung und Tests bevorzugt eine reine Leseberechtigung wie Global Reader
- ein separater Test-Tenant ohne produktive Gerätedaten

### Extension laden

```bash
npm ci
npm run build
```

Danach:

1. `edge://extensions` öffnen.
2. **Entwicklermodus** aktivieren.
3. **Entpackte Erweiterung laden** auswählen und den erzeugten Ordner `dist/` öffnen.
4. Nach jedem neuen Build auf der Extension-Karte **Neu laden** auswählen.

### Intune-Test

1. Selbst bei [https://intune.microsoft.com](https://intune.microsoft.com) anmelden.
2. **Geräte → Windows → Windows-Geräte** öffnen.
3. Prüfen, dass jeder gültige anonymisierte Name nach `NB-[Seriennummer]` genau ein `i` erhält.
4. Prüfen, dass nicht konforme Namen kein Symbol erhalten.
5. Für alle gültigen Geräte Popover, Ladezustand, Mock-Ergebnis und Schliessen per erneutem Klick,
   Aussenklick und `Escape` prüfen.
6. Eine andere rein lesende Intune-Ansicht öffnen und zur Windows-Geräteliste zurückkehren. Die
   Symbole müssen ohne Duplikate erneut erscheinen.
7. Rein lesend sortieren und scrollen. Symbole und Popover dürfen keinem falschen Gerät zugeordnet
   werden.
8. Die Seite neu laden. Jedes Symbol darf weiterhin nur einmal vorhanden sein.
9. Eine andere Intune-Ansicht mit einer Tabelle öffnen. Dort dürfen keine Warranty-Symbole
   erscheinen.
10. Die Extension deaktivieren und Intune neu laden. Es dürfen keine Symbole erscheinen. Danach die
    Extension wieder aktivieren und die Seite neu laden.
11. Frame- und Service-Worker-Konsole auf unbehandelte Fehler sowie Ausgaben realer Seriennummern
    prüfen.

Die Tests dürfen ausschliesslich lesende Navigation, Sortierung und Darstellung verwenden. Keine
Geräteaktionen, Synchronisationen oder Konfigurationsänderungen ausführen.

## Tests und Qualitätsprüfungen

Zentraler vollständiger Check:

```bash
npm run check
```

Er umfasst:

- Prettier-Formatprüfung
- TypeScript-Prüfung im Strict-Modus
- ESLint
- Vitest/jsdom-Tests
- Extension-Build

Einzelne Befehle:

```bash
npm run format:check
npm run typecheck
npm run lint
npm test
npm run build
```

Abhängigkeiten auf bekannte Schwachstellen prüfen:

```bash
npm audit
```

## Debugging

### Content Script und Popover

Auf der Mock-Seite erscheinen Content-Script-Fehler in der normalen Seitenkonsole. In Intune läuft
das Content Script innerhalb eines Cross-Origin-React-Blade-Iframes unter
`https://sandbox-N.reactblade.portal.azure.net/React/Index…`. In den Edge-Entwicklertools muss für
die Untersuchung der Ausführungskontext dieses Frames ausgewählt werden. `N` ist nicht stabil und
darf nicht fest codiert werden.

Im Elements-/Elemente-Bereich lassen sich `.warranty-info-button` und `#warranty-popover`
untersuchen. Keine Cookies, Tokens, Storage-Inhalte oder Netzwerkantworten für die DOM-Diagnose
auslesen.

### Background Service Worker

1. `edge://extensions` öffnen.
2. Bei der Extension **Details** auswählen.
3. Beim Eintrag **Service Worker** auf **Untersuchen** klicken.
4. Die separate Konsole und der Extension Storage stehen dort zur Diagnose zur Verfügung.

Der Service Worker ist absichtlich kurzlebig. Ein inaktiver Eintrag ist kein Fehler; eine neue
Nachricht startet ihn wieder. Dauerhafter Zustand liegt in `chrome.storage.local`, nicht in
globalen Variablen.

### Ladefehler

`edge://extensions` zeigt Manifest- und Laufzeitfehler direkt auf der Extension-Karte oder unter
**Fehler** an. Nach jedem neuen Build die Extension und danach die Mock-Seite neu laden.

## Berechtigungen

Das Manifest verwendet nur:

- `storage`: für den persistenten Cache in `chrome.storage.local`.
- `content_scripts.matches: http://127.0.0.1:4173/*`: lokaler Mock auf dem festgelegten Port.
- `content_scripts.matches: https://*.reactblade.portal.azure.net/React/Index*`: die von Intune
  verwendeten, wechselnden React-Blade-Frames.
- `content_scripts.all_frames: true`: jeder Frame wird unabhängig gegen die Match-Patterns geprüft;
  nur so kann das Content Script im passenden Cross-Origin-Frame laufen.

Die Intune-Ausführung verlangt zusätzlich die exakte Referrer-Origin `https://intune.microsoft.com`
und eine eindeutige DOM-Signatur aus DetailsList, `role="table"`, dem sprachunabhängigen
`deviceName`-Header und passenden Rowheader-Zellen. Ohne diese Signatur verändert die Extension den
DOM nicht.

Es gibt keine separate `host_permissions`-Deklaration und keine Freigaben für Lenovo,
Microsoft Graph, den Intune-Top-Level-Host, `tabs`, `webRequest` oder `<all_urls>`.

## Simulierte Testszenarien

| Seriennummer | Verhalten                                                     |
| ------------ | ------------------------------------------------------------- |
| `PF123ABC`   | Erfolgreiche Abfrage mit Garantiebeginn und Garantieende      |
| `PF987XYZ`   | Erfolgreiche Abfrage mit zwei Garantiepositionen              |
| `PF555AAA`   | Erfolgreiches Gerät für die simulierte Zeilenwiederverwendung |
| `PF404404`   | Seriennummer nicht gefunden                                   |
| `PF000000`   | Keine Garantiedaten vorhanden                                 |
| `PFNETWORK`  | Netzwerkfehler                                                |
| `PFOFFLINE`  | Garantiedienst nicht verfügbar                                |
| `PFDENIED`   | Fehlende Berechtigung                                         |

## Bekannte Einschränkungen

- das Intune-DOM ist keine öffentliche stabile API; Microsoft kann semantische Attribute ändern
- `data-automation-*`-Attribute und React-Blade-Hosts können sich durch Portal-Updates verändern
- noch keine Lenovo-API oder Untersuchung der Lenovo-Webseite
- ausschliesslich reproduzierbare Mock-Garantiedaten
- noch keine produktive Authentifizierung; ein Backend ist im aktuellen Zielbild bewusst nicht
  vorgesehen
- kein Microsoft Graph und keine Intune-API
- das Popover bleibt innerhalb des jeweiligen Cross-Origin-Iframe-Viewports
- Extension muss nach einem Watch-Build manuell im Browser neu geladen werden

`LocalStorageWarrantyCache` bleibt ausschliesslich als Phase-2-Referenz und Regressionstest im
Repository. Die Extension selbst verwendet ihn nicht; ihr Cache liegt zentral im Background
Service Worker über `ChromeStorageWarrantyCache`.
