import { COLUMN_TYPE_LABELS } from "@/lib/board-schema";
import type { BoardColumn, ColumnType } from "@/types";

const TYPE_DESCRIPTIONS: Readonly<Record<ColumnType, string>> = {
  text: "A short line of text",
  longText: "Several lines — a description, notes, steps",
  select: "One label from a fixed list",
  date: "A calendar date",
  user: "Somebody in this workspace",
  attachment: "Files",
  relation: "A link to a record on another board",
};

const NOT_IMPORTABLE: ReadonlySet<ColumnType> = new Set<ColumnType>([
  "user",
  "attachment",
  "relation",
]);

export function typeLabel(type: ColumnType): string {
  return COLUMN_TYPE_LABELS[type];
}

export function typeDescription(type: ColumnType): string {
  return TYPE_DESCRIPTIONS[type];
}

export function importRefusalFor(column: BoardColumn): string | null {
  if (column.type === "attachment") return "Files cannot come from a spreadsheet cell";
  if (column.type === "user") return "Needs a member id — a name in the file is not enough";
  if (column.type === "relation") return "Needs a record id from the linked board";

  if (column.type === "select" && column.config.options.length === 0) {
    return "This column has no labels to match against yet";
  }

  return null;
}

export function creationRefusalFor(type: ColumnType): string | null {
  if (NOT_IMPORTABLE.has(type)) {
    return `${COLUMN_TYPE_LABELS[type]} cannot be read from a spreadsheet`;
  }

  return null;
}
