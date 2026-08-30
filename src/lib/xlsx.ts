import { columnLabel, normalizeGrid, type Grid } from "@/lib/grid";
import { unzip, zipSync } from "@/lib/zip";

export interface Workbook {
  readonly rows: Grid;
  readonly sheetName: string;
}

const DEFAULT_SHEET_NAME = "Sheet1";

const ILLEGAL_SHEET_CHARS = /[:\\/?*[\]]/g;
const MAX_SHEET_NAME = 31;

const MAX_SHEET_ROWS = 100_000;

export function safeSheetName(name: string): string {
  const cleaned = name.replace(ILLEGAL_SHEET_CHARS, " ").trim().slice(0, MAX_SHEET_NAME);
  return cleaned.length > 0 ? cleaned : DEFAULT_SHEET_NAME;
}

const ROW_PATTERN = /<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g;
const CELL_PATTERN = /<c\b([^>]*)(?:\/>|>([\s\S]*?)<\/c>)/g;
const REFERENCE_PATTERN = /r="([A-Z]+)\d+"/;
const ROW_NUMBER_PATTERN = /\br="(\d+)"/;
const TYPE_PATTERN = /t="([^"]+)"/;
const VALUE_PATTERN = /<v>([\s\S]*?)<\/v>/;
const INLINE_PATTERN = /<t[^>]*>([\s\S]*?)<\/t>/g;
const SHARED_ITEM_PATTERN = /<si>([\s\S]*?)<\/si>/g;
const SHEET_NAME_PATTERN = /<sheet[^>]*name="([^"]*)"/;

export function buildXlsx(rows: Grid, sheetName = DEFAULT_SHEET_NAME): Uint8Array<ArrayBuffer> {
  const encoder = new TextEncoder();
  const safeName = safeSheetName(sheetName);
  const parts: readonly { name: string; xml: string }[] = [
    { name: "[Content_Types].xml", xml: contentTypesXml() },
    { name: "_rels/.rels", xml: rootRelsXml() },
    { name: "xl/workbook.xml", xml: workbookXml(safeName) },
    { name: "xl/_rels/workbook.xml.rels", xml: workbookRelsXml() },
    { name: "xl/worksheets/sheet1.xml", xml: sheetXml(normalizeGrid(rows)) },
  ];

  return zipSync(parts.map((part) => ({ name: part.name, data: encoder.encode(part.xml) })));
}

export async function parseXlsx(bytes: Uint8Array): Promise<Workbook> {
  const files = await unzip(bytes);
  const decoder = new TextDecoder();

  const sheetEntry =
    files.get("xl/worksheets/sheet1.xml") ??
    [...files.entries()].find(([name]) => name.startsWith("xl/worksheets/"))?.[1];

  if (!sheetEntry) throw new Error("The workbook has no worksheet");

  const shared = readSharedStrings(files.get("xl/sharedStrings.xml"), decoder);
  const workbook = files.get("xl/workbook.xml");
  const sheetName = workbook
    ? SHEET_NAME_PATTERN.exec(decoder.decode(workbook))?.[1] ?? DEFAULT_SHEET_NAME
    : DEFAULT_SHEET_NAME;

  return { rows: readSheet(decoder.decode(sheetEntry), shared), sheetName: decodeXml(sheetName) };
}

function readSharedStrings(entry: Uint8Array | undefined, decoder: TextDecoder): readonly string[] {
  if (!entry) return [];

  const xml = decoder.decode(entry);
  return [...xml.matchAll(SHARED_ITEM_PATTERN)].map((match) => textOf(match[1] ?? ""));
}

function readSheet(xml: string, shared: readonly string[]): Grid {
  const rows: string[][] = [];
  let cursor = 0;

  for (const rowMatch of xml.matchAll(ROW_PATTERN)) {
    const reference = ROW_NUMBER_PATTERN.exec(rowMatch[1] ?? "")?.[1];
    const index = reference ? Number.parseInt(reference, 10) - 1 : cursor;

    if (!Number.isFinite(index) || index < 0 || index >= MAX_SHEET_ROWS) continue;

    while (rows.length < index) rows.push([]);
    rows[index] = readRow(rowMatch[2] ?? "", shared);
    cursor = index + 1;
  }

  return normalizeGrid(rows);
}

function readRow(body: string, shared: readonly string[]): string[] {
  const cells: string[] = [];
  let cursor = 0;

  for (const cellMatch of body.matchAll(CELL_PATTERN)) {
    const attributes = cellMatch[1] ?? "";
    const reference = REFERENCE_PATTERN.exec(attributes)?.[1];
    const index = reference ? columnIndex(reference) : cursor;

    while (cells.length < index) cells.push("");
    cells[index] = readCell(attributes, cellMatch[2] ?? "", shared);
    cursor = index + 1;
  }

  return cells;
}

function readCell(attributes: string, body: string, shared: readonly string[]): string {
  const type = TYPE_PATTERN.exec(attributes)?.[1];
  if (type === "inlineStr") return textOf(body);

  const value = VALUE_PATTERN.exec(body)?.[1] ?? "";
  if (type === "s") {
    const index = Number.parseInt(value, 10);
    return shared[index] ?? "";
  }

  return decodeXml(value);
}

function textOf(fragment: string): string {
  return [...fragment.matchAll(INLINE_PATTERN)].map((match) => decodeXml(match[1] ?? "")).join("");
}

export function columnIndex(reference: string): number {
  let index = 0;

  for (const character of reference) {
    index = index * 26 + (character.charCodeAt(0) - 64);
  }

  return Math.max(0, index - 1);
}

function sheetXml(rows: Grid): string {
  const body = rows
    .map((row, rowIndex) => {
      const cells = row
        .map((cell, columnIndex) =>
          cell === ""
            ? ""
            : `<c r="${columnLabel(columnIndex)}${rowIndex + 1}" t="inlineStr"><is><t xml:space="preserve">${encodeXml(cell)}</t></is></c>`,
        )
        .join("");

      return `<row r="${rowIndex + 1}">${cells}</row>`;
    })
    .join("");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${body}</sheetData></worksheet>`;
}

function contentTypesXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`;
}

function rootRelsXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;
}

function workbookXml(sheetName: string): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${encodeXml(sheetName)}" sheetId="1" r:id="rId1"/></sheets></workbook>`;
}

function workbookRelsXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`;
}

function encodeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function decodeXml(value: string): string {
  return value
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'")
    .replaceAll(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number.parseInt(code, 10)))
    .replaceAll("&amp;", "&");
}
