import { cellText, emptyCellFor, isCellEmpty, type CellContext } from "@/lib/cell-values";
import type { BoardColumn, BoardRow, CellValue, ConversionPreview } from "@/types";

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/;
const DAY_FIRST = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/;
const YEAR_FIRST = /^(\d{4})[/.](\d{1,2})[/.](\d{1,2})$/;
const MAX_SAMPLES = 5;

export interface ParseResult {
  readonly value: CellValue;
  readonly ok: boolean;
}

export function parseTextIntoCell(
  text: string,
  column: BoardColumn,
  context: CellContext = {},
): ParseResult {
  const trimmed = text.trim();
  if (trimmed.length === 0) return { value: emptyCellFor(column.type), ok: true };

  switch (column.type) {
    case "text":
      return { value: { kind: "text", value: text }, ok: true };

    case "longText":
      return { value: { kind: "longText", value: text }, ok: true };

    case "select": {
      const labels = splitList(trimmed, column.config.isMulti);
      const matched = labels.map((label) => findOptionId(column, label));
      const optionIds = matched.filter((id): id is string => id !== null);

      return matched.some((id) => id === null)
        ? { value: { kind: "select", optionIds, text: trimmed }, ok: false }
        : { value: { kind: "select", optionIds }, ok: true };
    }

    case "date": {
      const iso = parseDate(trimmed);
      return iso
        ? { value: { kind: "date", iso }, ok: true }
        : { value: { kind: "date", iso: null, text: trimmed }, ok: false };
    }

    case "user": {
      const names = splitList(trimmed, column.config.isMulti);
      const matched = names.map((name) => findUserId(name, context));
      const userIds = matched.filter((id): id is string => id !== null);

      return matched.some((id) => id === null)
        ? { value: { kind: "user", userIds, text: trimmed }, ok: false }
        : { value: { kind: "user", userIds }, ok: true };
    }

    case "attachment":
      return { value: { kind: "attachment", attachments: [], text: trimmed }, ok: false };

    case "relation": {
      const ids = splitList(trimmed, column.config.isMulti);
      const rowIds = ids
        .map((label) => findRelationId(label, context))
        .filter((id): id is string => id !== null);

      return rowIds.length === ids.length
        ? { value: { kind: "relation", rowIds }, ok: true }
        : { value: { kind: "relation", rowIds, text: trimmed }, ok: false };
    }
  }
}

export function convertCell(
  value: CellValue,
  source: BoardColumn,
  target: BoardColumn,
  context: CellContext = {},
): ParseResult {
  if (source.type === target.type) return { value, ok: true };
  if (isCellEmpty(value)) return { value: emptyCellFor(target.type), ok: true };

  if (value.kind === "attachment" && target.type === "attachment") {
    return { value, ok: true };
  }

  return parseTextIntoCell(cellText(value, source, context), target, context);
}

export function previewConversion(
  rows: readonly BoardRow[],
  source: BoardColumn,
  target: BoardColumn,
  context: CellContext = {},
): ConversionPreview {
  let converted = 0;
  let preserved = 0;
  const samples: string[] = [];

  for (const row of rows) {
    const value = row.cells[source.id];
    if (!value || isCellEmpty(value)) continue;

    const result = convertCell(value, source, target, context);
    if (result.ok) {
      converted += 1;
      continue;
    }

    preserved += 1;
    if (samples.length < MAX_SAMPLES) samples.push(cellText(value, source, context));
  }

  return { total: converted + preserved, converted, preserved, samples };
}

function splitList(text: string, isMulti: boolean): readonly string[] {
  if (!isMulti) return [text];
  return text
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

function findOptionId(column: BoardColumn, label: string): string | null {
  if (column.type !== "select") return null;
  const needle = label.toLowerCase();

  return (
    column.config.options.find((option) => option.label.toLowerCase() === needle)?.id ?? null
  );
}

function findUserId(name: string, context: CellContext): string | null {
  const needle = name.toLowerCase();

  for (const person of context.people?.values() ?? []) {
    if (person.name.toLowerCase() === needle || person.email.toLowerCase() === needle) {
      return person.id;
    }
  }

  return null;
}

function findRelationId(label: string, context: CellContext): string | null {
  const needle = label.toLowerCase();

  for (const [rowId, rowLabel] of context.relationLabels ?? []) {
    if (rowId === label || rowLabel.toLowerCase() === needle) return rowId;
  }

  return null;
}

export function parseDate(text: string): string | null {
  const iso = ISO_DATE.exec(text);
  if (iso) {
    const [, year, month, day, hour = "00", minute = "00"] = iso;
    return buildIso(Number(year), Number(month), Number(day), Number(hour), Number(minute));
  }

  const dayFirst = DAY_FIRST.exec(text);
  if (dayFirst) {
    const [, day, month, year] = dayFirst;
    return buildIso(Number(year), Number(month), Number(day), 0, 0);
  }

  const yearFirst = YEAR_FIRST.exec(text);
  if (yearFirst) {
    const [, year, month, day] = yearFirst;
    return buildIso(Number(year), Number(month), Number(day), 0, 0);
  }

  const parsed = Date.parse(text);
  return Number.isNaN(parsed) ? null : new Date(parsed).toISOString();
}

function buildIso(year: number, month: number, day: number, hour: number, minute: number): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59) return null;

  const date = new Date(Date.UTC(year, month - 1, day, hour, minute));
  if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;

  return date.toISOString();
}
