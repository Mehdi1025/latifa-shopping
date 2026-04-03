/**
 * Parseur CSV minimal (guillemets, virgules, CRLF / LF).
 */
export function parseCsv(text: string): string[][] {
  const lines: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let i = 0;
  let inQuotes = false;
  const pushRow = () => {
    const r = [...row, cell];
    cell = "";
    row = [];
    if (r.some((x) => String(x).trim() !== "")) {
      lines.push(r);
    }
  };

  while (i < text.length) {
    const c = text[i]!;
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      cell += c;
      i++;
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (c === ",") {
      row.push(cell);
      cell = "";
      i++;
      continue;
    }
    if (c === "\r") {
      i++;
      if (text[i] === "\n") i++;
      pushRow();
      continue;
    }
    if (c === "\n") {
      i++;
      pushRow();
      continue;
    }
    cell += c;
    i++;
  }
  const last = [...row, cell];
  if (last.some((x) => String(x).trim() !== "")) {
    lines.push(last);
  }
  return lines;
}
