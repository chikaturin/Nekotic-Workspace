import { createId } from "@/lib/utils";
import type {
  BoardColumn,
  ColumnConfigByType,
  ColumnPatch,
  ColumnType,
  SelectColor,
  SelectOption,
} from "@/types";

export const MIN_COLUMN_WIDTH = 88;
export const MAX_COLUMN_WIDTH = 720;
export const DEFAULT_COLUMN_WIDTH = 180;
export const PRIMARY_COLUMN_WIDTH = 280;

export const COLUMN_TYPE_LABELS: Readonly<Record<ColumnType, string>> = {
  text: "Text",
  longText: "Long text",
  select: "Select",
  date: "Date",
  user: "User",
  attachment: "Attachment",
  relation: "Relation",
};

export const SELECT_COLORS: readonly SelectColor[] = [
  "blue",
  "green",
  "amber",
  "red",
  "violet",
  "cyan",
  "pink",
  "gray",
];

const DEFAULT_CONFIG: { readonly [T in ColumnType]: () => ColumnConfigByType[T] } = {
  text: () => ({}),
  longText: () => ({ rows: 4 }),
  select: () => ({ options: [], isMulti: false }),
  date: () => ({ includesTime: false }),
  user: () => ({ isMulti: false }),
  attachment: () => ({ maxFiles: 10 }),
  relation: () => ({ boardId: null, displayColumnId: null, isMulti: true }),
};

export function defaultConfigFor<T extends ColumnType>(type: T): ColumnConfigByType[T] {
  return DEFAULT_CONFIG[type]();
}

/** Build a column of `type` with the defaults its editors expect. */
export function makeColumn(
  id: string,
  name: string,
  type: ColumnType,
  position: number,
  overrides: Partial<Pick<BoardColumn, "width" | "hidden" | "isPrimary">> = {},
): BoardColumn {
  const base = {
    id,
    name,
    position,
    width: overrides.width ?? DEFAULT_COLUMN_WIDTH,
    hidden: overrides.hidden ?? false,
    isPrimary: overrides.isPrimary ?? false,
  };

  return { ...base, type, config: defaultConfigFor(type) } as BoardColumn;
}

export function clampColumnWidth(width: number): number {
  return Math.min(MAX_COLUMN_WIDTH, Math.max(MIN_COLUMN_WIDTH, Math.round(width)));
}

/* ---------------------------------------------------------- schema updates */

export function upsertColumn(
  columns: readonly BoardColumn[],
  column: BoardColumn,
): readonly BoardColumn[] {
  const exists = columns.some((candidate) => candidate.id === column.id);
  return exists
    ? columns.map((candidate) => (candidate.id === column.id ? column : candidate))
    : [...columns, column];
}

export function patchColumn(
  columns: readonly BoardColumn[],
  columnId: string,
  patch: ColumnPatch,
): readonly BoardColumn[] {
  return columns.map((column) => {
    if (column.id !== columnId) return column;

    const next = {
      ...column,
      ...(patch.name === undefined ? {} : { name: patch.name }),
      ...(patch.width === undefined ? {} : { width: clampColumnWidth(patch.width) }),
      // The primary column titles the row, so it can never be hidden.
      ...(patch.hidden === undefined || column.isPrimary ? {} : { hidden: patch.hidden }),
    };

    return (patch.config ? { ...next, config: { ...column.config, ...patch.config } } : next) as BoardColumn;
  });
}

export function removeColumn(
  columns: readonly BoardColumn[],
  columnId: string,
): readonly BoardColumn[] {
  const target = columns.find((column) => column.id === columnId);
  if (!target || target.isPrimary) return columns;

  return reposition(columns.filter((column) => column.id !== columnId));
}

/** Move a column to an index, renumbering `position` for the whole schema. */
export function moveColumn(
  columns: readonly BoardColumn[],
  columnId: string,
  toIndex: number,
): readonly BoardColumn[] {
  const ordered = [...columns].sort((a, b) => a.position - b.position);
  const from = ordered.findIndex((column) => column.id === columnId);
  if (from < 0) return columns;

  const target = Math.min(Math.max(toIndex, 0), ordered.length - 1);
  if (from === target) return columns;

  const [moved] = ordered.splice(from, 1);
  if (!moved) return columns;

  ordered.splice(target, 0, moved);
  return reposition(ordered);
}

function reposition(columns: readonly BoardColumn[]): readonly BoardColumn[] {
  return columns.map((column, index) =>
    column.position === index ? column : { ...column, position: index },
  );
}

/** Change a column's type. Values are converted separately, by the caller. */
export function retypeColumn(
  columns: readonly BoardColumn[],
  columnId: string,
  type: ColumnType,
  config?: ColumnConfigByType[ColumnType],
): readonly BoardColumn[] {
  return columns.map((column) =>
    column.id === columnId
      ? ({ ...column, type, config: config ?? defaultConfigFor(type) } as BoardColumn)
      : column,
  );
}

/* --------------------------------------------------------- select options */

/** Deterministic colour so a new option never repeats its neighbour. */
export function nextOptionColor(options: readonly SelectOption[]): SelectColor {
  return SELECT_COLORS[options.length % SELECT_COLORS.length] ?? "gray";
}

export function makeOption(label: string, options: readonly SelectOption[], seed: number): SelectOption {
  return {
    id: createId("opt", seed),
    label: label.trim(),
    color: nextOptionColor(options),
  };
}

/** Options already holding `label`, case-insensitively. */
export function findOptionByLabel(
  options: readonly SelectOption[],
  label: string,
): SelectOption | undefined {
  const needle = label.trim().toLowerCase();
  return options.find((option) => option.label.toLowerCase() === needle);
}

export const SELECT_COLOR_CLASSES: Readonly<Record<SelectColor, string>> = {
  gray: "bg-kind-other/15 text-kind-other border-kind-other/30",
  blue: "bg-kind-folder/15 text-kind-folder border-kind-folder/30",
  green: "bg-kind-spreadsheet/15 text-kind-spreadsheet border-kind-spreadsheet/30",
  amber: "bg-kind-archive/15 text-kind-archive border-kind-archive/30",
  red: "bg-kind-pdf/15 text-kind-pdf border-kind-pdf/30",
  violet: "bg-kind-board/15 text-kind-board border-kind-board/30",
  cyan: "bg-kind-image/15 text-kind-image border-kind-image/30",
  pink: "bg-kind-video/15 text-kind-video border-kind-video/30",
};
