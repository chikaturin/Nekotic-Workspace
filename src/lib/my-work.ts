import { dayKey } from "@/lib/board-dates";
import { cellOf, optionById } from "@/lib/cell-values";
import { rowRef } from "@/lib/entity-ref";
import type {
  Board,
  BoardColumn,
  BoardColumnOf,
  BoardRow,
  DirectoryUser,
  MyWorkItem,
  SelectColor,
} from "@/types";

const ASSIGNEE_NAMES = /assign|owner|tester|responsible/i;
const DUE_NAMES = /due|deadline/i;
const STATUS_NAMES = /status|result|state/i;

export const DONE_LABELS: ReadonlySet<string> = new Set([
  "done",
  "complete",
  "completed",
  "closed",
  "resolved",
  "verified",
  "fixed",
  "passed",
  "cancelled",
  "won't fix",
  "wont fix",
]);

export interface BoardLenses {
  readonly assignee: BoardColumnOf<"user"> | null;
  readonly due: BoardColumnOf<"date"> | null;
  readonly status: BoardColumnOf<"select"> | null;
  readonly primary: BoardColumn | null;
}

function pick<T extends BoardColumn>(
  columns: readonly BoardColumn[],
  type: T["type"],
  names: RegExp,
  fallbackToFirst: boolean,
): T | null {
  const ofType = columns.filter((column): column is T => column.type === type);
  return ofType.find((column) => names.test(column.name)) ?? (fallbackToFirst ? ofType[0] ?? null : null);
}

export function lensesFor(board: Board): BoardLenses {
  return {
    assignee: pick<BoardColumnOf<"user">>(board.columns, "user", ASSIGNEE_NAMES, true),
    due: pick<BoardColumnOf<"date">>(board.columns, "date", DUE_NAMES, false),
    status: pick<BoardColumnOf<"select">>(board.columns, "select", STATUS_NAMES, true),
    primary: board.columns.find((column) => column.id === board.primaryColumnId) ?? null,
  };
}

export function statusOf(
  row: BoardRow,
  lenses: BoardLenses,
): { readonly label: string | null; readonly color: SelectColor | null } {
  if (!lenses.status) return { label: null, color: null };

  const value = cellOf(row, lenses.status);
  if (value.kind !== "select") return { label: null, color: null };

  const option = value.optionIds[0]
    ? optionById(lenses.status.config.options, value.optionIds[0])
    : undefined;

  return { label: option?.label ?? null, color: option?.color ?? null };
}

export function isDone(row: BoardRow, lenses: BoardLenses): boolean {
  const { label } = statusOf(row, lenses);
  return label !== null && DONE_LABELS.has(label.toLowerCase());
}

export function assigneeIds(row: BoardRow, lenses: BoardLenses): readonly string[] {
  if (!lenses.assignee) return [];

  const value = cellOf(row, lenses.assignee);
  return value.kind === "user" ? value.userIds : [];
}

export function dueOf(row: BoardRow, lenses: BoardLenses): string | null {
  if (!lenses.due) return null;

  const value = cellOf(row, lenses.due);
  return value.kind === "date" ? value.iso : null;
}

export function titleOf(row: BoardRow, lenses: BoardLenses): string {
  if (!lenses.primary) return row.displayId;

  const value = cellOf(row, lenses.primary);
  const text = value.kind === "text" || value.kind === "longText" ? value.value.trim() : "";
  return text.length > 0 ? text : "Untitled record";
}

export interface ItemInput {
  readonly widgetId: string;
  readonly nodeId: string;
  readonly boardName: string;
  readonly board: Board;
  readonly row: BoardRow;
  readonly lenses: BoardLenses;
  readonly people: ReadonlyMap<string, DirectoryUser>;
}

export function toItem({
  widgetId,
  nodeId,
  boardName,
  board,
  row,
  lenses,
  people,
}: ItemInput): MyWorkItem {
  const { label, color } = statusOf(row, lenses);
  const title = titleOf(row, lenses);

  return {
    id: `${widgetId}:${row.id}`,
    ref: rowRef({ nodeId, boardId: board.id, rowId: row.id, label: row.displayId }),
    displayId: row.displayId,
    title,
    boardName,
    statusLabel: label,
    statusColor: color,
    dueIso: dueOf(row, lenses),
    updatedAt: row.updatedAt,
    assignees: assigneeIds(row, lenses)
      .map((id) => people.get(id))
      .filter((person): person is DirectoryUser => Boolean(person)),
  };
}

export function isSameCalendarDay(iso: string | null, referenceIso: string): boolean {
  const day = dayKey(iso);
  return day !== null && day === dayKey(referenceIso);
}

export function isBeforeDay(iso: string | null, referenceIso: string): boolean {
  const day = dayKey(iso);
  const reference = dayKey(referenceIso);
  return day !== null && reference !== null && day < reference;
}

export function isWithinDays(
  iso: string | null,
  referenceIso: string,
  days: number,
): boolean {
  const day = dayKey(iso);
  const reference = dayKey(referenceIso);
  if (day === null || reference === null) return false;

  const horizon = dayKey(
    new Date(Date.parse(`${reference}T00:00:00.000Z`) + days * 86_400_000).toISOString(),
  );

  return horizon !== null && day > reference && day <= horizon;
}
