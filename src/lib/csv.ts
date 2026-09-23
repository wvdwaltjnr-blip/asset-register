// Minimal CSV writer — handles quoted fields with embedded commas, quotes
// ("" escaping) and newlines. No external dependency.

function toCsvField(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function toCsv(
  headers: string[],
  rows: (string | number | null | undefined)[][]
): string {
  const lines = [headers.map(toCsvField).join(",")];
  for (const row of rows) {
    lines.push(
      row.map((v) => toCsvField(v === null || v === undefined ? "" : String(v))).join(",")
    );
  }
  return lines.join("\r\n") + "\r\n";
}
