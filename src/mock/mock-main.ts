import { MockPageController } from "./mock-page-controller";
import "../styles.css";

const tableBody = requireElement<HTMLTableSectionElement>("#device-table-body");
const filterInput = requireElement<HTMLInputElement>("#device-filter");
const statusElement = requireElement<HTMLElement>("#mock-status");

const page = new MockPageController(tableBody, filterInput, statusElement);
page.start();

function requireElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (element === null) {
    throw new Error(`Erwartetes Element fehlt: ${selector}`);
  }
  return element;
}
