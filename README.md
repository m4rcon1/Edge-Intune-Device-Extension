# Edge Intune Device Extension – lokaler Mock-Prototyp

Dieser Projektstand implementiert ausschliesslich den lokalen Mock-Prototyp. Er verbindet sich
weder mit Microsoft Intune noch mit Lenovo und ist noch keine Edge Extension. Sämtliche Geräte-
und Garantieinformationen sind simuliert.

## Funktionsumfang

- Erkennung von Gerätenamen nach `NB-[Seriennummer]`
- Extraktion und Normalisierung der Seriennummer
- genau ein Informationssymbol pro unterstütztem Gerät
- Popover mit Lade-, Erfolgs- und Fehlerzuständen
- Schliessen per erneutem Klick, Klick ausserhalb, Schliessschaltfläche oder `Escape`
- mehrere Garantiepositionen und eindeutig getrennte Datumsfelder
- erfolgreicher Cache für sieben Tage
- negativer Cache für „nicht gefunden“ und „keine Daten“ für 24 Stunden
- kein dauerhafter Cache für technische Fehler
- manueller Refresh und manuelles Leeren des Caches
- simulierte Sortierung, Filterung, vollständiges Ersetzen und Wiederverwenden von Tabellenzeilen

Der lokale Prototyp verwendet `localStorage`. Der Cache-Vertrag ist absichtlich asynchron, damit
er in einer späteren Extension durch eine Implementierung mit `chrome.storage.local` ersetzt
werden kann. Reale Seriennummern dürfen in diesem Mock nicht verwendet werden.

## Voraussetzungen

- Node.js 20 oder neuer
- npm
- Microsoft Edge oder ein anderer moderner Browser

Prüfen der installierten Versionen:

```bash
node --version
npm --version
```

Die Befehle verändern nichts. Sie zeigen lediglich die verfügbaren Versionen an.

## Installation

Im Projektordner:

```bash
npm install
```

Dieser Befehl installiert die in `package.json` aufgeführten Entwicklungswerkzeuge lokal im
Ordner `node_modules`. Sie werden nicht global auf dem Rechner installiert.

## Lokal starten

```bash
npm run dev
```

Der Befehl baut die TypeScript-Dateien und startet einen lokalen Entwicklungsserver. Danach ist
der Prototyp normalerweise unter [http://127.0.0.1:4173](http://127.0.0.1:4173) erreichbar.
Änderungen an TypeScript und CSS werden automatisch neu gebaut. Nach einer Änderung an
`mock/index.html` muss der Entwicklungsserver neu gestartet werden.

Beenden: im Terminal `Ctrl+C` drücken.

## Qualitätsprüfungen

```bash
npm run format:check
npm run typecheck
npm run lint
npm test
npm run build
```

- `format:check` prüft die Formatierung, ohne Dateien zu verändern.
- `typecheck` prüft alle TypeScript-Typen im Strict-Modus.
- `lint` sucht nach problematischen TypeScript- und JavaScript-Mustern.
- `test` führt die automatisierten Tests einmalig aus.
- `build` erzeugt die lokal auslieferbaren Dateien im ignorierten Ordner `dist`.

Alle Prüfungen zusammen:

```bash
npm run check
```

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

## Architekturgrenzen

`WarrantyProvider` kapselt die Datenquelle. Der Prototyp verwendet nur `MockWarrantyProvider`.
`WarrantyCache` kapselt den Cache. Der Prototyp nutzt im Browser `LocalStorageWarrantyCache` und
in Tests `MemoryWarrantyCache`.

Ein späterer echter Lenovo-Provider darf erst nach Prüfung einer offiziellen, zulässigen API
implementiert werden. Ein Backend gehört nicht zum aktuellen Zielbild und ist in diesem Projekt
nicht enthalten.
