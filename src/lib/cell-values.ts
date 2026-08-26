import { formatDate } from "@/lib/format";
import type {
  BoardColumn,
  BoardRow,
  CellValue,
  ColumnType,
  DirectoryUser,
  SelectOption,
} from "@/types";

/** Lookups a cell needs to render or serialise itself. */
export interface CellContext {
  readonly people?: ReadonlyMap<string, DirectoryUser>;
  /** Display label per related row id, filled in by the relation resolver. */
  readonly relationLabels?: ReadonlyMap<string, string>;
  /** True once every relation target has been looked up. Until then an id that
   * is missing from the map is unknown, not deleted. */
  readonly relationResolved?: boolean;
}

/** Shown when a relation points at a row that no longer exists. */
export const DELETED_LABEL = "[Deleted Item]";

const EMPTY_BY_TYPE: { readonly [T in ColumnType]: () => CellValue } = {
  text: () => ({ kind: "text", value: "" }),
  longText: () => ({ kind: "longText", value: "" }),
  select: () => ({ kind: "select", optionIds: [] }),
  date: () => ({ kind: "date", iso: null }),
  user: () => ({ kind: "user", userIds: [] }),
  attachment: () => ({ kind: "attachment", attachments: [] }),
  relation: () => ({ kind: "relation", rowIds: [] }),
};

export function emptyCellFor(type: ColumnType): CellValue {
  return EMPTY_BY_TYPE[type]();
}

/**
 * The value stored for a column, or an empty one. A stored value whose kind no
 * longer matches the column (a schema change that raced an edit) is treated as
 * empty rather than rendered by the wrong editor.
 */
export function cellOf(row: BoardRow, column: BoardColumn): CellValue {
  const value = row.cells[column.id];
  return value && value.kind === column.type ? value : emptyCellFor(column.type);
}

export function isCellEmpty(value: CellValue): boolean {
  switch (value.kind) {
    case "text":
    case "longText":
      return value.value.trim().length === 0;
    case "select":
      return value.optionIds.length === 0 && !value.text;
    case "date":
      return value.iso === null && !value.text;
    case "user":
      return value.userIds.length === 0 && !value.text;
    case "attachment":
      return value.attachments.length === 0;
    case "relation":
      return value.rowIds.length === 0 && !value.text;
  }
}

/** True when a cell holds text the column could not parse — rendered with a warning. */
export function hasUnparsedText(value: CellValue): boolean {
  return (
    (value.kind === "select" || value.kind === "date" || value.kind === "user" ||
      value.kind === "relation" || value.kind === "attachment") &&
    typeof value.text === "string" &&
    value.text.length > 0
  );
}

export function optionById(
  options: readonly SelectOption[],
  optionId: string,
): SelectOption | undefined {
  return options.find((option) => option.id === optionId);
}

/**
 * Plain-text projection of a cell — the single representation used by copy,
 * export, search, sorting and every column conversion.
 */
export function cellText(value: CellValue, column: BoardColumn, context: CellContext = {}): string {
  switch (value.kind) {
    case "text":
    case "longText":
      return value.value;

    case "select": {
      if (column.type !== "select") return value.text ?? "";
      const labels = value.optionIds
        .map((id) => optionById(column.config.options, id)?.label)
        .filter((label): label is string => Boolean(label));
      return labels.length > 0 ? labels.join(", ") : value.text ?? "";
    }

    case "date": {
      if (!value.iso) return value.text ?? "";
      const includesTime = column.type === "date" && column.config.includesTime;
      return includesTime ? formatDateTime(value.iso) : formatDate(value.iso);
    }

    case "user": {
      const names = value.userIds
        .map((id) => context.people?.get(id)?.name)
        .filter((name): name is string => Boolean(name));
      return names.length > 0 ? names.join(", ") : value.text ?? "";
    }

    case "attachment":
      return value.attachments.map((file) => file.name).join(", ");

    case "relation": {
      const labels = value.rowIds.map(
        (id) => context.relationLabels?.get(id) ?? (context.relationResolved ? DELETED_LABEL : id),
      );
      return labels.length > 0 ? labels.join(", ") : value.text ?? "";
    }
  }
}

export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";

  return `${formatDate(iso)} ${date.toISOString().slice(11, 16)}`;
}

/**
 * Sort key for a cell. Empty values always land last, whatever the direction,
 * so the caller compares `[isEmpty, key]` pairs.
 */
export function cellSortKey(
  value: CellValue,
  column: BoardColumn,
  context: CellContext = {},
): { readonly isEmpty: boolean; readonly key: string | number } {
  if (isCellEmpty(value)) return { isEmpty: true, key: "" };

  if (value.kind === "date" && value.iso) {
    return { isEmpty: false, key: Date.parse(value.iso) };
  }

  if (value.kind === "select" && column.type === "select") {
    // Select sorts by option order, which is the meaningful one for statuses.
    const first = value.optionIds[0];
    const index = column.config.options.findIndex((option) => option.id === first);
    return { isEmpty: false, key: index < 0 ? Number.MAX_SAFE_INTEGER : index };
  }

  return { isEmpty: false, key: cellText(value, column, context).toLowerCase() };
}

function sameList(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((item, index) => item === b[index]);
}

/**
 * Structural equality for cell values. Optimistic rollback compares what it
 * wrote against what is on screen now, so this has to be exact rather than
 * reference-based.
 */
export function cellEquals(a: CellValue | undefined, b: CellValue | undefined): boolean {
  if (a === b) return true;
  if (!a || !b || a.kind !== b.kind) return false;

  switch (a.kind) {
    case "text":
    case "longText":
      return a.value === (b as typeof a).value;
    case "select":
      return a.text === (b as typeof a).text && sameList(a.optionIds, (b as typeof a).optionIds);
    case "date":
      return a.iso === (b as typeof a).iso && a.text === (b as typeof a).text;
    case "user":
      return a.text === (b as typeof a).text && sameList(a.userIds, (b as typeof a).userIds);
    case "relation":
      return a.text === (b as typeof a).text && sameList(a.rowIds, (b as typeof a).rowIds);
    case "attachment": {
      const other = b as typeof a;
      return (
        a.text === other.text &&
        sameList(
          a.attachments.map((file) => file.id),
          other.attachments.map((file) => file.id),
        )
      );
    }
  }
}
