interface MockDevice {
  deviceName: string;
  primaryUser: string;
  compliance: "Konform" | "Nicht konform" | "Unbekannt";
  lastCheckIn: string;
}

const MOCK_DEVICES: readonly MockDevice[] = [
  {
    deviceName: "NB-PF123ABC",
    primaryUser: "A. Keller",
    compliance: "Konform",
    lastCheckIn: "Heute, 08:42",
  },
  {
    deviceName: "NB-PF987XYZ",
    primaryUser: "M. Steiner",
    compliance: "Konform",
    lastCheckIn: "Heute, 08:17",
  },
  {
    deviceName: "NB-PF404404",
    primaryUser: "L. Brunner",
    compliance: "Konform",
    lastCheckIn: "Gestern, 17:31",
  },
  {
    deviceName: "NB-PF000000",
    primaryUser: "S. Frei",
    compliance: "Nicht konform",
    lastCheckIn: "Gestern, 13:09",
  },
  {
    deviceName: "NB-PFNETWORK",
    primaryUser: "N. Müller",
    compliance: "Unbekannt",
    lastCheckIn: "18.08.2026, 15:20",
  },
  {
    deviceName: "NB-PFOFFLINE",
    primaryUser: "P. Meier",
    compliance: "Konform",
    lastCheckIn: "18.08.2026, 11:04",
  },
  {
    deviceName: "NB-PFDENIED",
    primaryUser: "C. Schmid",
    compliance: "Konform",
    lastCheckIn: "17.08.2026, 16:48",
  },
  {
    deviceName: "DESKTOP-1042",
    primaryUser: "Shared Device",
    compliance: "Konform",
    lastCheckIn: "Heute, 07:58",
  },
  {
    deviceName: "NB-INVALID-NAME",
    primaryUser: "Testgerät",
    compliance: "Unbekannt",
    lastCheckIn: "Noch nie",
  },
];

export class MockPageController {
  #sortAscending = true;
  #virtualizedAlternative = false;

  public constructor(
    private readonly tableBody: HTMLTableSectionElement,
    private readonly filterInput: HTMLInputElement,
    private readonly statusElement: HTMLElement,
  ) {}

  public start(): void {
    this.renderRows();

    this.filterInput.addEventListener("input", () => this.renderRows());
    document.querySelector("#sort-devices")?.addEventListener("click", () => {
      this.#sortAscending = !this.#sortAscending;
      this.renderRows();
      this.setStatus(`Gerätenamen ${this.#sortAscending ? "aufsteigend" : "absteigend"} sortiert.`);
    });
    document.querySelector("#reload-table")?.addEventListener("click", () => {
      this.renderRows();
      this.setStatus("Tabellenzeilen wurden vollständig ersetzt.");
    });
    document.querySelector("#reuse-row")?.addEventListener("click", () => this.reuseFirstRow());
  }

  public setStatus(message: string): void {
    this.statusElement.textContent = message;
  }

  private renderRows(): void {
    const filter = this.filterInput.value.trim().toLocaleLowerCase("de-CH");
    const devices = MOCK_DEVICES.filter((device) =>
      device.deviceName.toLocaleLowerCase("de-CH").includes(filter),
    ).sort((first, second) => {
      const order = first.deviceName.localeCompare(second.deviceName, "de-CH");
      return this.#sortAscending ? order : -order;
    });

    this.tableBody.replaceChildren(...devices.map((device) => createDeviceRow(device)));
    const countElement = document.querySelector("#device-count");
    if (countElement !== null) {
      countElement.textContent = `${devices.length} Geräte`;
    }
  }

  private reuseFirstRow(): void {
    const firstNameElement = this.tableBody.querySelector<HTMLElement>(".device-name");
    if (firstNameElement === null) {
      this.setStatus("Keine sichtbare Zeile zur Wiederverwendung vorhanden.");
      return;
    }

    this.#virtualizedAlternative = !this.#virtualizedAlternative;
    firstNameElement.textContent = this.#virtualizedAlternative ? "NB-PF555AAA" : "DESKTOP-REUSED";
    this.setStatus(
      `Erste DOM-Zeile simuliert jetzt ${firstNameElement.textContent ?? "ein anderes Gerät"}.`,
    );
  }
}

function createDeviceRow(device: MockDevice): HTMLTableRowElement {
  const row = document.createElement("tr");
  row.append(
    createDeviceNameCell(device.deviceName),
    createCell(device.primaryUser),
    createComplianceCell(device.compliance),
    createCell(device.lastCheckIn),
  );
  return row;
}

function createDeviceNameCell(deviceName: string): HTMLTableCellElement {
  const cell = document.createElement("td");
  const entry = document.createElement("span");
  entry.className = "device-entry";
  const name = document.createElement("span");
  name.className = "device-name";
  name.textContent = deviceName;
  entry.append(name);
  cell.append(entry);
  return cell;
}

function createCell(value: string): HTMLTableCellElement {
  const cell = document.createElement("td");
  cell.textContent = value;
  return cell;
}

function createComplianceCell(value: MockDevice["compliance"]): HTMLTableCellElement {
  const cell = createCell(value);
  cell.dataset.compliance = value;
  return cell;
}
