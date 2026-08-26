import { normalizeGrid, type Grid } from "@/lib/grid";

/**
 * RFC 4180 CSV — quoted fields, escaped quotes (`""`), embedded separators and
 * newlines. Delimiter is a parameter so the same code reads TSV.
 */
export function parseDelimited(text: string, delimiter = ","): Grid {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let isQuoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];

    if (isQuoted) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          isQuoted = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"' && field === "") {
      isQuoted = true;
    } else if (char === delimiter) {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char !== "\r") {
      field += char;
    }
  }

  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return normalizeGrid(rows);
}

const NEEDS_QUOTES = /["\n\r]/;

export function toDelimited(rows: Grid, delimiter = ","): string {
  return rows
    .map((row) =>
      row
        .map((cell) =>
          cell.includes(delimiter) || NEEDS_QUOTES.test(cell)
            ? `"${cell.replaceAll('"', '""')}"`
            : cell,
        )
        .join(delimiter),
    )
    .join("\n");
}

/** `.tsv` files are tab separated; everything else in this app is a comma. */
export function delimiterFor(extension: string): string {
  return extension.toLowerCase() === "tsv" ? "\t" : ",";
}
