import { addDays, dayIndex, daysBetween, startOfDay } from "@/lib/board-dates";
import {
  childIdsOf,
  descendantIdsOf,
  isRowCompleted,
  subtaskProgress,
  type HierarchyEntry,
  type HierarchyIndex,
  type SubtaskProgress,
} from "@/lib/board-hierarchy";
import type { RowMap } from "@/lib/board-records";
import { cellOf } from "@/lib/cell-values";
import type { BoardColumn, BoardColumnOf, CellEdit } from "@/types";

export type GanttBarKind =
  | "task"
  | "summary";

export type GanttGap =
  | "none"
  | "partial"
  | "inverted";

export interface GanttSchedule {
  readonly startIso: string;
  readonly endIso: string;
  readonly offset: number;
  readonly span: number;
}

export interface GanttRow {
  readonly rowId: string;
  readonly depth: number;
  readonly hasChildren: boolean;
  readonly childCount: number;
  readonly isCollapsed: boolean;
  readonly schedule: GanttSchedule | null;
  readonly kind: GanttBarKind;
  readonly isDerived: boolean;
  readonly gap: GanttGap | null;
  readonly progress: SubtaskProgress | null;
  readonly completionRatio: number;
}

export interface GanttRowsInput {
  readonly entries: readonly HierarchyEntry[];
  readonly rowsById: RowMap;
  readonly index: HierarchyIndex;
  readonly startColumn: BoardColumn | null;
  readonly endColumn: BoardColumn | null;
  readonly completionColumn: BoardColumnOf<"select"> | null;
  readonly rangeStartIso: string;
}

export interface GanttRows {
  readonly scheduled: readonly GanttRow[];
  readonly unscheduled: readonly GanttRow[];
}

function readDate(rowId: string, rows: RowMap, column: BoardColumn | null): string | null {
  if (!column) return null;

  const row = rows[rowId];
  if (!row) return null;

  const value = cellOf(row, column);
  if (value.kind !== "date" || value.iso === null) return null;

  return startOfDay(value.iso);
}

function subtreeRange(
  rowId: string,
  input: GanttRowsInput,
): { readonly start: string; readonly end: string } | null {
  let min: string | null = null;
  let max: string | null = null;

  for (const childId of descendantIdsOf(input.index, rowId)) {
    const start = readDate(childId, input.rowsById, input.startColumn);
    const end = readDate(childId, input.rowsById, input.endColumn);

    for (const iso of [start, end]) {
      if (!iso) continue;
      if (!min || dayIndex(iso) < dayIndex(min)) min = iso;
      if (!max || dayIndex(iso) > dayIndex(max)) max = iso;
    }
  }

  return min && max ? { start: min, end: max } : null;
}

function scheduleOf(startIso: string, endIso: string, rangeStartIso: string): GanttSchedule {
  return {
    startIso,
    endIso,
    offset: daysBetween(rangeStartIso, startIso),
    span: Math.max(1, daysBetween(startIso, endIso) + 1),
  };
}

export function buildGanttRows(input: GanttRowsInput): GanttRows {
  const scheduled: GanttRow[] = [];
  const unscheduled: GanttRow[] = [];

  for (const entry of input.entries) {
    const { rowId } = entry;
    const rawStart = readDate(rowId, input.rowsById, input.startColumn);
    const rawEnd = readDate(rowId, input.rowsById, input.endColumn);

    const childIds = childIdsOf(input.index, rowId);
    const progress =
      childIds.length > 0
        ? subtaskProgress(childIds, input.rowsById, input.completionColumn)
        : null;

    const measured = progress && progress.isMeasurable ? progress : null;

    const base = {
      rowId,
      depth: entry.depth,
      hasChildren: entry.hasChildren,
      childCount: entry.childCount,
      isCollapsed: entry.isCollapsed,
      progress: measured,
      completionRatio: measured
        ? measured.ratio
        : isRowCompleted(input.rowsById[rowId], input.completionColumn)
          ? 1
          : 0,
    };

    if (rawStart && rawEnd && dayIndex(rawStart) > dayIndex(rawEnd)) {
      unscheduled.push({ ...base, schedule: null, kind: "task", isDerived: false, gap: "inverted" });
      continue;
    }

    if (rawStart && rawEnd) {
      scheduled.push({
        ...base,
        schedule: scheduleOf(rawStart, rawEnd, input.rangeStartIso),
        kind: "task",
        isDerived: false,
        gap: null,
      });
      continue;
    }

    if (rawStart || rawEnd) {
      unscheduled.push({ ...base, schedule: null, kind: "task", isDerived: false, gap: "partial" });
      continue;
    }

    const derived = entry.hasChildren ? subtreeRange(rowId, input) : null;
    if (derived) {
      scheduled.push({
        ...base,
        schedule: scheduleOf(derived.start, derived.end, input.rangeStartIso),
        kind: "summary",
        isDerived: true,
        gap: null,
      });
      continue;
    }

    unscheduled.push({ ...base, schedule: null, kind: "task", isDerived: false, gap: "none" });
  }

  return { scheduled, unscheduled };
}

export const DEFAULT_SPAN_DAYS = 3;

export interface ScheduleFill {
  readonly startIso: string;
  readonly endIso: string;
}

export function fillScheduleFor(
  startIso: string | null,
  endIso: string | null,
  todayIso: string,
): ScheduleFill | null {
  if (startIso && endIso) return null;

  const span = DEFAULT_SPAN_DAYS - 1;
  if (startIso) return { startIso, endIso: addDays(startIso, span) };
  if (endIso) return { startIso: addDays(endIso, -span), endIso };

  const today = startOfDay(todayIso);
  return { startIso: today, endIso: addDays(today, span) };
}

export function fillScheduleEdits(
  rows: readonly GanttRow[],
  rowsById: RowMap,
  startColumn: BoardColumn | null,
  endColumn: BoardColumn | null,
  todayIso: string,
): readonly CellEdit[] {
  if (!startColumn || !endColumn) return [];

  const edits: CellEdit[] = [];

  for (const row of rows) {
    const start = readDate(row.rowId, rowsById, startColumn);
    const end = readDate(row.rowId, rowsById, endColumn);

    const fill = fillScheduleFor(start, end, todayIso);
    if (!fill) continue;

    if (!start) {
      edits.push({
        rowId: row.rowId,
        columnId: startColumn.id,
        value: { kind: "date", iso: fill.startIso },
      });
    }
    if (!end) {
      edits.push({
        rowId: row.rowId,
        columnId: endColumn.id,
        value: { kind: "date", iso: fill.endIso },
      });
    }
  }

  return edits;
}

export function fillableRows(rows: readonly GanttRow[]): readonly GanttRow[] {
  return rows.filter((row) => row.gap === "none" || row.gap === "partial");
}

export interface GanttLink {
  readonly fromRowId: string;
  readonly toRowId: string;
  readonly isConflict: boolean;
}

export function relationColumnsOf(columns: readonly BoardColumn[]): readonly BoardColumn[] {
  return columns.filter((column) => column.type === "relation");
}

export function buildGanttLinks(
  rows: readonly GanttRow[],
  rowsById: RowMap,
  columns: readonly BoardColumn[],
): readonly GanttLink[] {
  const relations = relationColumnsOf(columns);
  if (relations.length === 0) return [];

  const byId = new Map(rows.map((row) => [row.rowId, row]));
  const links: GanttLink[] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    const record = rowsById[row.rowId];
    if (!record) continue;

    for (const column of relations) {
      const value = record.cells[column.id];
      if (!value || value.kind !== "relation") continue;

      for (const blockerId of value.rowIds) {
        if (blockerId === row.rowId) continue;

        const blocker = byId.get(blockerId);
        if (!blocker?.schedule || !row.schedule) continue;

        const key = `${blockerId}->${row.rowId}`;
        if (seen.has(key)) continue;
        seen.add(key);

        links.push({
          fromRowId: blockerId,
          toRowId: row.rowId,
          isConflict: dayIndex(row.schedule.startIso) < dayIndex(blocker.schedule.endIso),
        });
      }
    }
  }

  return links;
}

export function spanDays(startIso: string, endIso: string): number {
  return Math.max(1, daysBetween(startIso, endIso) + 1);
}
