# Edge Intune Device Extension – Manifest-V3-Prototyp

Phase 3 stellt eine echte, lokal installierbare Microsoft-Edge-Erweiterung bereit. Sie greift als
Content Script in eine separat gestartete Mock-Intune-Seite ein und bezieht ausschliesslich
simulierte Garantiedaten von ihrem Background Service Worker.

Es bestehen keine Verbindungen zu Microsoft Intune, Lenovo, Microsoft Graph, einem Backend oder
anderen externen Diensten. Sämtliche Geräte- und Garantiedaten sind erfunden.

## Architektur

```text
Lokale Mock-Intune-Seite
        │
        ▼
Content Script und Popover
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
5. Prüfen, dass „Intune Lenovo Warranty Mock“ ohne Fehler angezeigt wird.

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

1. Mock-Seite öffnen.
2. Mit `F12` die normalen Seitentools öffnen.
3. Fehler des Content Scripts erscheinen in der Konsole der Mock-Seite.
4. Im Elements-/Elemente-Bereich lassen sich `.warranty-info-button` und
   `#warranty-popover` untersuchen.

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
- `content_scripts.matches: http://127.0.0.1:4173/*`: damit der Browser das Content Script
  automatisch und ausschliesslich auf dem festgelegten lokalen Entwicklungsport injizieren kann.
  Das Content Script prüft zusätzlich eine eindeutige Markierung der Mock-Seite und beendet sich
  auf anderen Seiten ohne DOM-Eingriff.

Es gibt keine `host_permissions` und insbesondere keine Berechtigungen für Intune, Lenovo,
Microsoft Graph, `tabs`, `webRequest` oder `<all_urls>`.

## Simulierte Testszenarien

| Seriennummer | Verhalten                                                     |
| ------------ | ------------------------------------------------------------- |
| `PF123ABC`   | Erfolgreiche Abfrage mit Kaufdatum und Garantiezeitraum       |
| `PF987XYZ`   | Erfolgreiche Abfrage mit zwei Garantiepositionen              |
| `PF555AAA`   | Erfolgreiches Gerät für die simulierte Zeilenwiederverwendung |
| `PF404404`   | Seriennummer nicht gefunden                                   |
| `PF000000`   | Keine Garantiedaten vorhanden                                 |
| `PFNETWORK`  | Netzwerkfehler                                                |
| `PFOFFLINE`  | Garantiedienst nicht verfügbar                                |
| `PFDENIED`   | Fehlende Berechtigung                                         |

## Bekannte Einschränkungen

- noch keine Verbindung zum echten Microsoft Intune
- noch keine Analyse des Intune-DOM
- noch keine Lenovo-API oder Untersuchung der Lenovo-Webseite
- ausschliesslich reproduzierbare Mock-Garantiedaten
- noch keine produktive Authentifizierung; ein Backend ist im aktuellen Zielbild bewusst nicht
  vorgesehen
- Content-Script-Freigabe nur für die lokale HTTP-Mock-Seite auf `127.0.0.1`
- Extension muss nach einem Watch-Build manuell im Browser neu geladen werden

`LocalStorageWarrantyCache` bleibt ausschliesslich als Phase-2-Referenz und Regressionstest im
Repository. Die Extension selbst verwendet ihn nicht; ihr Cache liegt zentral im Background
Service Worker über `ChromeStorageWarrantyCache`.
