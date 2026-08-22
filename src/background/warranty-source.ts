const MOCK_PAGE_ORIGIN = "http://127.0.0.1:4173";

export function isLocalMockPageUrl(value: string | undefined): boolean {
  if (value === undefined) {
    return false;
  }

  try {
    return new URL(value).origin === MOCK_PAGE_ORIGIN;
  } catch {
    return false;
  }
}
