const DEFAULT_SPREADSHEET_ID = '1KtveBZ3Hn3ex2H5iV1BGF-nlahE9r45DkPP1vLNkkP8';

/**
 * Fetch a public Google Sheet tab as a 2D string array.
 * Uses the GViz CSV endpoint — no API key required for public sheets.
 */
export async function fetchSheetCSV(
  sheetName: string,
  spreadsheetId?: string,
): Promise<string[][]> {
  const id =
    spreadsheetId ??
    process.env['GOOGLE_SPREADSHEET_ID'] ??
    DEFAULT_SPREADSHEET_ID;

  const url =
    `https://docs.google.com/spreadsheets/d/${id}` +
    `/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(
      `Could not read sheet "${sheetName}" (HTTP ${res.status}). ` +
      `Make sure the Google Sheet is set to "Anyone with the link → Viewer".`,
    );
  }
  return parseCSV(await res.text());
}

/** Minimal RFC-4180-compliant CSV parser — handles quoted fields with embedded commas. */
export function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch   = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') { field += '"'; i++; }
      else if (ch === '"')            { inQuotes = false; }
      else                            { field += ch; }
    } else {
      if      (ch === '"')  { inQuotes = true; }
      else if (ch === ',')  { row.push(field); field = ''; }
      else if (ch === '\r' && next === '\n') {
        row.push(field); field = '';
        if (row.some((f) => f)) rows.push(row);
        row = []; i++;
      }
      else if (ch === '\n' || ch === '\r') {
        row.push(field); field = '';
        if (row.some((f) => f)) rows.push(row);
        row = [];
      }
      else { field += ch; }
    }
  }
  if (field || row.length) { row.push(field); if (row.some((f) => f)) rows.push(row); }
  return rows;
}

/** Build a header-name → column-index Map from the first row. */
export function buildHeaderMap(headers: string[]): Map<string, number> {
  const map = new Map<string, number>();
  headers.forEach((h, i) => map.set(h.trim(), i));
  return map;
}

/** "Ali Khan" → "ali_khan" */
export function toUsername(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
}
