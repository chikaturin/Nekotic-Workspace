import { isRowArchived } from "@/lib/archive";
import { partitionBulkTargets } from "@/lib/bulk";
import { convertCell } from "@/lib/cell-conversion";
import { cellText, emptyCellFor, type CellContext } from "@/lib/cell-values";
import {
  defaultConfigFor,
  makeColumn,
  moveColumn,
  patchColumn,
  removeColumn,
  retypeColumn,
} from "@/lib/board-schema";
import { formatRowId, matchesRowId } from "@/lib/row-id";
import { buildBoard, prefixForBoard } from "@/mock/board";
import { CURRENT_USER, DIRECTORY } from "@/mock/users";
import {
  assertNoSimulatedListFailure,
  nextId,
  nowIso,
  readDelay,
  writeDelay,
} from "@/services/backend";
import { appError, conflict, notFound, ServiceError } from "@/services/errors";
import { shouldFailSave } from "@/services/simulation";
import { findNodeById, flattenTree } from "@/lib/tree";
import { getActiveTree } from "@/store/workspace-store";
import { isBoard } from "@/types";
import type {
  Board,
  BoardColumn,
  BoardNode,
  BoardRow,
  BoardSnapshot,
  BulkMoveResult,
  BulkResult,
  CellEdit,
  CellValue,
  ColumnPatch,
  ColumnType,
  ConflictNotice,
  ActivityEntry,
  EntityRef,
  FieldChange,
  SavedView,
  SelectOption,
} from "@/types";

/**
 * In-memory board backend.
 *
 * It is deliberately shaped like the HTTP API that replaces it: reads and
 * writes are async, every write returns the authoritative record, and the row
 * id sequence lives *here* — the client never invents a `TASK-00n`.
 */

interface BoardRecord {
  board: Board;
  rows: Map<string, BoardRow>;
  order: string[];
  /** Monotonic per board. Deleting a row never releases its number. */
  sequence: number;
  activity: ActivityEntry[];
  optionSeed: number;
}

const registry = new Map<string, BoardRecord>();

function seedFromNode(nodeId: string): BoardRecord {
  const node = findNodeById(getActiveTree(), nodeId);
  if (!node || !isBoard(node)) throw notFound("That board");

  const kind = node.boardKind === "doc" ? "table" : node.boardKind;
  const { board, rows } = buildBoard({
    nodeId: node.id,
    workspaceId: node.workspaceId,
    name: node.name,
    kind,
    rowCount: node.itemCount,
    ...(node.templateId ? { templateId: node.templateId } : {}),
  });

  return {
    board,
    rows: new Map(rows.map((row) => [row.id, row])),
    order: rows.map((row) => row.id),
    sequence: rows.length,
    activity: [],
    optionSeed: 0,
  };
}

function recordFor(nodeId: string): BoardRecord {
  const existing = registry.get(nodeId);
  if (existing) return existing;

  const created = seedFromNode(nodeId);
  registry.set(nodeId, created);
  return created;
}

/** The id scheme lives here alone, so nothing else has to know it. */
export function boardIdFor(nodeId: string): string {
  return `brd_${nodeId}`;
}

function nodeIdFromBoardId(boardId: string): string {
  return boardId.startsWith("brd_") ? boardId.slice(4) : boardId;
}

/** Look a board up by id, seeding it from the tree if it is not loaded yet. */
function recordByBoardId(boardId: string): BoardRecord {
  const loaded = loadedRecord(boardId);
  if (loaded) return loaded;

  return recordFor(nodeIdFromBoardId(boardId));
}

/** The same lookup without the seeding side effect. */
function loadedRecord(boardId: string): BoardRecord | null {
  for (const record of registry.values()) {
    if (record.board.id === boardId) return record;
  }
  return null;
}

/** Simulated write failure — the switch every rollback path is tested against. */
function assertWritable(record: BoardRecord, subject: string): void {
  if (shouldFailSave(record.board.name)) {
    throw new ServiceError(appError("unknown", `Could not save ${subject}`));
  }
}

function rowOrThrow(record: BoardRecord, rowId: string): BoardRow {
  const row = record.rows.get(rowId);
  if (!row) throw notFound("That record");
  return row;
}

/**
 * Append to a record's history.
 *
 * One call is one entry, however many fields it carries: a write that changes
 * Status and Due Date together is a single line in the timeline with two
 * changes under it, never two lines racing for the same second.
 */
function logActivity(
  record: BoardRecord,
  rowId: string,
  summary: string,
  kind: ActivityEntry["kind"],
  changes: readonly FieldChange[] = [],
) {
  const actor = DIRECTORY.find((person) => person.id === CURRENT_USER.id) ?? DIRECTORY[0]!;
  record.activity.unshift({
    id: nextId("act"),
    rowId,
    kind,
    actor,
    summary,
    changes,
    createdAt: nowIso(),
  });
}

/** Lookups the activity log needs to render a value the way the column does. */
function contextFor(record: BoardRecord): CellContext {
  const labels = new Map<string, string>();
  for (const [rowId, row] of record.rows) labels.set(rowId, row.displayId);

  return {
    people: new Map(DIRECTORY.map((person) => [person.id, person])),
    relationLabels: labels,
    relationResolved: false,
  };
}

/** What a write did to one record, as text — the only form the UI ever sees. */
function describeEdits(
  record: BoardRecord,
  before: BoardRow,
  after: BoardRow,
  columnIds: readonly string[],
  context: CellContext,
): readonly FieldChange[] {
  const changes: FieldChange[] = [];

  for (const columnId of new Set(columnIds)) {
    const column = record.board.columns.find((candidate) => candidate.id === columnId);
    if (!column) continue;

    const from = before.cells[columnId];
    const to = after.cells[columnId];
    const fromText = from ? cellText(from, column, context) : "";
    const toText = to ? cellText(to, column, context) : "";
    if (fromText === toText) continue;

    changes.push({ columnName: column.name, from: fromText, to: toText });
  }

  return changes;
}

function editSummary(changes: readonly FieldChange[], fallback: string): string {
  if (changes.length === 0) return fallback;
  if (changes.length === 1) return `changed ${changes[0]!.columnName}`;
  return `changed ${changes.length} fields`;
}

/* -------------------------------------------------------------------- read */

async function getBoard(nodeId: string, signal?: AbortSignal): Promise<BoardSnapshot> {
  await readDelay(signal);
  assertNoSimulatedListFailure("this board");

  const record = recordFor(nodeId);

  return {
    board: record.board,
    rows: record.order.map((id) => record.rows.get(id)).filter((row): row is BoardRow => Boolean(row)),
    people: DIRECTORY,
    // The whole record set arrives in one page today; see the API report.
    nextCursor: null,
  };
}

/** Rows of any board, matched by display id or primary text — for Relation. */
async function searchRows(
  boardId: string,
  query: string,
  limit = 20,
  signal?: AbortSignal,
): Promise<readonly BoardRow[]> {
  await readDelay(signal);

  const record = recordByBoardId(boardId);
  const needle = query.trim().toLowerCase();
  const primaryId = record.board.primaryColumnId;
  const matches: BoardRow[] = [];

  for (const rowId of record.order) {
    if (matches.length >= limit) break;

    const row = record.rows.get(rowId);
    if (!row) continue;

    const title = row.cells[primaryId];
    const label = title && title.kind === "text" ? title.value.toLowerCase() : "";

    if (needle.length === 0 || matchesRowId(row.displayId, query) || label.includes(needle)) {
      matches.push(row);
    }
  }

  return matches;
}

/* ------------------------------------------------------------------- rows */

export interface CreateRowInput {
  readonly boardId: string;
  /** Insert after this row; appended when omitted. */
  readonly afterRowId?: string | null;
  readonly cells?: Readonly<Record<string, import("@/types").CellValue>>;
}

/**
 * The backend owns the counter. It only ever increases, so deleting `TASK-005`
 * does not hand `005` to the next record.
 */
async function createRow({ boardId, afterRowId, cells }: CreateRowInput, signal?: AbortSignal): Promise<BoardRow> {
  await writeDelay(signal);
  const record = recordByBoardId(boardId);
  assertWritable(record, "the record");

  record.sequence += 1;
  const now = nowIso();

  const row: BoardRow = {
    id: nextId("row"),
    boardId,
    displayId: formatRowId(record.board.rowIdPrefix, record.sequence),
    sequence: record.sequence,
    cells: cells ?? emptyCells(record.board.columns),
    createdAt: now,
    updatedAt: now,
    createdBy: CURRENT_USER.id,
    revision: 1,
  };

  const at = afterRowId ? record.order.indexOf(afterRowId) + 1 : record.order.length;
  record.order.splice(at <= 0 ? record.order.length : at, 0, row.id);
  record.rows.set(row.id, row);
  logActivity(record, row.id, `created ${row.displayId}`, "created");

  return row;
}

async function duplicateRow(boardId: string, rowId: string, signal?: AbortSignal): Promise<BoardRow> {
  const record = recordByBoardId(boardId);
  const source = rowOrThrow(record, rowId);

  return createRow({ boardId, afterRowId: rowId, cells: { ...source.cells } }, signal);
}

async function deleteRow(boardId: string, rowId: string, signal?: AbortSignal): Promise<void> {
  await writeDelay(signal);
  const record = recordByBoardId(boardId);
  assertWritable(record, "the deletion");

  rowOrThrow(record, rowId);
  record.rows.delete(rowId);
  record.order = record.order.filter((id) => id !== rowId);
}

export interface UpdateCellsInput {
  readonly boardId: string;
  readonly edits: readonly CellEdit[];
  /** Revision each edit was based on, so the server can spot a stale write. */
  readonly baseRevisions?: Readonly<Record<string, number>>;
}

export interface UpdateCellsResult {
  readonly rows: readonly BoardRow[];
  readonly conflicts: readonly ConflictNotice[];
}

/**
 * Batched cell write. Stale writes are applied last-write-wins and reported
 * back as conflicts rather than rejected, which is the policy the PRD names.
 */
async function updateCells(
  { boardId, edits, baseRevisions = {} }: UpdateCellsInput,
  signal?: AbortSignal,
): Promise<UpdateCellsResult> {
  await writeDelay(signal);
  const record = recordByBoardId(boardId);
  assertWritable(record, edits.length === 1 ? "the cell" : "those cells");

  const touched = new Map<string, BoardRow>();
  const conflicts: ConflictNotice[] = [];
  const now = nowIso();

  for (const edit of edits) {
    const current = touched.get(edit.rowId) ?? record.rows.get(edit.rowId);
    if (!current) continue;

    const base = baseRevisions[edit.rowId];
    if (base !== undefined && base < current.revision && !touched.has(edit.rowId)) {
      conflicts.push({
        id: nextId("cfl"),
        rowId: edit.rowId,
        columnId: edit.columnId,
        message: `${current.displayId} changed elsewhere — your edit was kept`,
      });
    }

    touched.set(edit.rowId, {
      ...current,
      cells: { ...current.cells, [edit.columnId]: edit.value },
      updatedAt: now,
      revision: current.revision + 1,
    });
  }

  const context = contextFor(record);

  for (const row of touched.values()) {
    const before = record.rows.get(row.id);
    record.rows.set(row.id, row);
    if (!before) continue;

    const columnIds = edits.filter((edit) => edit.rowId === row.id).map((edit) => edit.columnId);
    const changes = describeEdits(record, before, row, columnIds, context);
    logActivity(record, row.id, editSummary(changes, `updated ${row.displayId}`), "updated", changes);
  }

  return { rows: [...touched.values()], conflicts };
}

function emptyCells(columns: readonly BoardColumn[]): Readonly<Record<string, import("@/types").CellValue>> {
  return Object.fromEntries(columns.map((column) => [column.id, emptyCellFor(column.type)]));
}

/* ---------------------------------------------------------------- columns */

async function createColumn(
  boardId: string,
  type: ColumnType,
  name: string,
  signal?: AbortSignal,
): Promise<BoardColumn> {
  await writeDelay(signal);
  const record = recordByBoardId(boardId);
  assertWritable(record, "the column");

  const column = makeColumn(nextId("col"), name, type, record.board.columns.length);
  record.board = { ...record.board, columns: [...record.board.columns, column], updatedAt: nowIso() };

  return column;
}

async function updateColumn(
  boardId: string,
  columnId: string,
  patch: ColumnPatch,
  signal?: AbortSignal,
): Promise<BoardColumn> {
  await writeDelay(signal);
  const record = recordByBoardId(boardId);
  assertWritable(record, "the column");

  const columns = patchColumn(record.board.columns, columnId, patch);
  record.board = { ...record.board, columns, updatedAt: nowIso() };

  const updated = columns.find((column) => column.id === columnId);
  if (!updated) throw notFound("That column");
  return updated;
}

async function reorderColumn(
  boardId: string,
  columnId: string,
  toIndex: number,
  signal?: AbortSignal,
): Promise<readonly BoardColumn[]> {
  await writeDelay(signal);
  const record = recordByBoardId(boardId);
  assertWritable(record, "the column order");

  const columns = moveColumn(record.board.columns, columnId, toIndex);
  record.board = { ...record.board, columns, updatedAt: nowIso() };
  return columns;
}

async function deleteColumn(
  boardId: string,
  columnId: string,
  signal?: AbortSignal,
): Promise<readonly BoardColumn[]> {
  await writeDelay(signal);
  const record = recordByBoardId(boardId);
  assertWritable(record, "the column");

  const columns = removeColumn(record.board.columns, columnId);
  record.board = { ...record.board, columns, updatedAt: nowIso() };

  for (const [rowId, row] of record.rows) {
    if (!(columnId in row.cells)) continue;
    const cells = { ...row.cells };
    delete cells[columnId];
    record.rows.set(rowId, { ...row, cells, revision: row.revision + 1 });
  }

  return columns;
}

export interface ConvertColumnResult {
  readonly column: BoardColumn;
  readonly rows: readonly BoardRow[];
  readonly preserved: number;
}

/**
 * Change a column's type and rewrite its values. Anything the target type
 * cannot parse is preserved as text on the new value, never dropped.
 */
async function convertColumn(
  boardId: string,
  columnId: string,
  type: ColumnType,
  signal?: AbortSignal,
): Promise<ConvertColumnResult> {
  await writeDelay(signal);
  const record = recordByBoardId(boardId);
  assertWritable(record, "the conversion");

  const source = record.board.columns.find((column) => column.id === columnId);
  if (!source) throw notFound("That column");

  const columns = retypeColumn(record.board.columns, columnId, type, defaultConfigFor(type));
  const target = columns.find((column) => column.id === columnId);
  if (!target) throw notFound("That column");

  const people = new Map(DIRECTORY.map((person) => [person.id, person]));
  const updated: BoardRow[] = [];
  let preserved = 0;

  for (const [rowId, row] of record.rows) {
    const value = row.cells[columnId];
    if (!value) continue;

    const result = convertCell(value, source, target, { people });
    if (!result.ok) preserved += 1;

    const next = { ...row, cells: { ...row.cells, [columnId]: result.value }, revision: row.revision + 1 };
    record.rows.set(rowId, next);
    updated.push(next);
  }

  record.board = { ...record.board, columns, updatedAt: nowIso() };
  return { column: target, rows: updated, preserved };
}

async function createSelectOption(
  boardId: string,
  columnId: string,
  label: string,
  color: SelectOption["color"],
  signal?: AbortSignal,
): Promise<SelectOption> {
  await writeDelay(signal);
  const record = recordByBoardId(boardId);
  assertWritable(record, "the option");

  const column = record.board.columns.find((candidate) => candidate.id === columnId);
  if (!column || column.type !== "select") throw notFound("That select column");

  record.optionSeed += 1;
  const option: SelectOption = { id: nextId("opt"), label: label.trim(), color };

  record.board = {
    ...record.board,
    columns: record.board.columns.map((candidate) =>
      candidate.id === columnId && candidate.type === "select"
        ? { ...candidate, config: { ...candidate.config, options: [...candidate.config.options, option] } }
        : candidate,
    ),
    updatedAt: nowIso(),
  };

  return option;
}

/* ------------------------------------------------------------------ views */

async function updateView(
  boardId: string,
  viewId: string,
  patch: Partial<SavedView>,
  signal?: AbortSignal,
): Promise<SavedView> {
  await writeDelay(signal);
  const record = recordByBoardId(boardId);
  assertWritable(record, "the view");

  const views = record.board.views.map((view) =>
    view.id === viewId ? { ...view, ...patch, id: view.id, boardId: view.boardId } : view,
  );
  record.board = { ...record.board, views, updatedAt: nowIso() };

  const updated = views.find((view) => view.id === viewId);
  if (!updated) throw notFound("That view");
  return updated;
}

export interface CreateViewInput {
  readonly name: string;
  readonly type: SavedView["type"];
  /** Copy configuration from an existing view — how "duplicate" works. */
  readonly from?: SavedView;
}

/** A saved view is configuration only. Creating one never touches a record. */
async function createView(
  boardId: string,
  { name, type, from }: CreateViewInput,
  signal?: AbortSignal,
): Promise<SavedView> {
  await writeDelay(signal);
  const record = recordByBoardId(boardId);
  assertWritable(record, "the view");

  const base: SavedView = from ?? {
    id: "",
    boardId,
    name,
    type,
    filters: [],
    filterConjunction: "and",
    sorts: [],
    hiddenColumnIds: [],
    columnOrder: [],
    columnWidths: {},
    rowHeight: "medium",
    groupByColumnId: null,
    hideEmptyGroups: false,
    dateColumnId: null,
    endDateColumnId: null,
  };

  const view: SavedView = { ...base, id: nextId("view"), boardId, name, type };
  record.board = { ...record.board, views: [...record.board.views, view], updatedAt: nowIso() };

  return view;
}

async function deleteView(
  boardId: string,
  viewId: string,
  signal?: AbortSignal,
): Promise<readonly SavedView[]> {
  await writeDelay(signal);
  const record = recordByBoardId(boardId);
  assertWritable(record, "the view");

  // A board always keeps at least one view to fall back to.
  if (record.board.views.length <= 1) {
    throw new ServiceError(
      appError("conflict", "A board needs at least one view", { isRetryable: false }),
    );
  }

  const views = record.board.views.filter((view) => view.id !== viewId);
  record.board = { ...record.board, views, updatedAt: nowIso() };

  return views;
}

/* ------------------------------------------------------------- activity */

/**
 * Record an activity entry from outside the board service — posting a comment
 * on a record, today.
 *
 * Non-record targets have no board stream. A board that is not loaded is left
 * alone rather than seeded: activity belongs to the board's own record, and a
 * real backend writes it server-side whether or not this client has read the
 * board.
 */
function noteActivity(target: EntityRef, summary: string, kind: ActivityEntry["kind"]): void {
  if (target.kind !== "row" || !target.boardId || !target.rowId) return;

  const record = loadedRecord(target.boardId);
  if (!record || !record.rows.has(target.rowId)) return;

  logActivity(record, target.rowId, summary, kind);
}

async function listActivity(
  boardId: string,
  rowId: string,
  signal?: AbortSignal,
): Promise<readonly ActivityEntry[]> {
  await readDelay(signal);
  const record = recordByBoardId(boardId);

  const row = record.rows.get(rowId);
  const seeded: readonly ActivityEntry[] = row
    ? [
        {
          id: `${rowId}_created`,
          rowId,
          kind: "created",
          actor: DIRECTORY.find((person) => person.id === row.createdBy) ?? DIRECTORY[0]!,
          summary: `created ${row.displayId}`,
          changes: [],
          createdAt: row.createdAt,
        },
      ]
    : [];

  return [...record.activity.filter((entry) => entry.rowId === rowId), ...seeded];
}

/* ------------------------------------------------------------------- bulk */

export interface BulkTargets {
  readonly boardId: string;
  readonly rowIds: readonly string[];
}

export interface BulkUpdateInput extends BulkTargets {
  /** One value per column, written to every record the action may touch. */
  readonly values: Readonly<Record<string, CellValue>>;
}

/**
 * Write the same values across a selection.
 *
 * This is the endpoint that exists so the client never loops: 100 records is
 * one round trip. The answer accounts for every id that was asked for —
 * `applied` plus `skipped` — because a bulk write that silently drops a record
 * is worse than one that refuses.
 */
async function bulkUpdate(
  { boardId, rowIds, values }: BulkUpdateInput,
  signal?: AbortSignal,
): Promise<BulkResult> {
  await writeDelay(signal);
  const record = recordByBoardId(boardId);
  assertWritable(record, "those records");

  const { targets, skipped } = partitionBulkTargets(rowIds, (id) => record.rows.get(id));
  const columnIds = Object.keys(values);
  const context = contextFor(record);
  const now = nowIso();
  const rows: BoardRow[] = [];

  for (const row of targets) {
    const next: BoardRow = {
      ...row,
      cells: { ...row.cells, ...values },
      updatedAt: now,
      revision: row.revision + 1,
    };

    record.rows.set(next.id, next);
    rows.push(next);

    const changes = describeEdits(record, row, next, columnIds, context);
    logActivity(record, next.id, editSummary(changes, `updated ${next.displayId}`), "updated", changes);
  }

  return { requested: rowIds.length, rows, applied: rows.map((row) => row.id), skipped };
}

export interface BulkArchiveInput extends BulkTargets {
  readonly isArchived: boolean;
}

/**
 * Freeze or unfreeze a selection. Archived records stay readable and keep their
 * history; they simply stop accepting writes — which is why this call is the
 * one that may target them.
 */
async function bulkArchive(
  { boardId, rowIds, isArchived }: BulkArchiveInput,
  signal?: AbortSignal,
): Promise<BulkResult> {
  await writeDelay(signal);
  const record = recordByBoardId(boardId);
  assertWritable(record, isArchived ? "the archive" : "the restore");

  const { targets, skipped } = partitionBulkTargets(rowIds, (id) => record.rows.get(id), {
    allowArchived: true,
  });

  const now = nowIso();
  const rows: BoardRow[] = [];

  for (const row of targets) {
    const wasArchived = isRowArchived(row);
    const next: BoardRow = {
      ...row,
      archivedAt: isArchived ? now : null,
      updatedAt: now,
      revision: row.revision + 1,
    };

    record.rows.set(next.id, next);
    rows.push(next);

    // Re-archiving something already archived is a no-op worth honouring but
    // not worth logging twice.
    if (wasArchived !== isArchived) {
      logActivity(
        record,
        next.id,
        isArchived ? "archived this record" : "restored this record",
        isArchived ? "archived" : "restored",
      );
    }
  }

  return { requested: rowIds.length, rows, applied: rows.map((row) => row.id), skipped };
}

/** Permanent, and said so at the call site: records have no trash of their own. */
async function bulkDelete(
  { boardId, rowIds }: BulkTargets,
  signal?: AbortSignal,
): Promise<BulkResult> {
  await writeDelay(signal);
  const record = recordByBoardId(boardId);
  assertWritable(record, "the deletion");

  // Archiving freezes edits, not removal — a frozen record can still be binned.
  const { targets, skipped } = partitionBulkTargets(rowIds, (id) => record.rows.get(id), {
    allowArchived: true,
  });

  const removed = new Set(targets.map((row) => row.id));
  for (const id of removed) record.rows.delete(id);
  record.order = record.order.filter((id) => !removed.has(id));
  record.activity = record.activity.filter((entry) => !removed.has(entry.rowId));

  return { requested: rowIds.length, rows: [], applied: [...removed], skipped };
}

export interface BulkMoveInput extends BulkTargets {
  /** Drive node of the destination board. */
  readonly targetNodeId: string;
}

const NOISE = /[^a-z0-9]/g;
const normalizeName = (value: string): string => value.toLowerCase().replace(NOISE, "");

/**
 * Move records to another board.
 *
 * The two boards have different schemas, so cells travel through the column
 * *conversion* path: matched by name, then re-read into the destination's type.
 * Anything the destination cannot hold is reported by name rather than dropped
 * quietly, and the destination assigns its own record ids.
 */
async function bulkMove(
  { boardId, rowIds, targetNodeId }: BulkMoveInput,
  signal?: AbortSignal,
): Promise<BulkMoveResult> {
  await writeDelay(signal);

  const source = recordByBoardId(boardId);
  const target = recordFor(targetNodeId);

  if (target.board.id === source.board.id) {
    throw conflict("Those records are already on that board");
  }

  assertWritable(source, "the move");
  assertWritable(target, "the move");

  const { targets, skipped } = partitionBulkTargets(rowIds, (id) => source.rows.get(id));

  const pairs = new Map<string, BoardColumn>();
  for (const column of source.board.columns) {
    const match = target.board.columns.find(
      (candidate) => normalizeName(candidate.name) === normalizeName(column.name),
    );
    if (match) pairs.set(column.id, match);
  }

  const droppedColumns = source.board.columns
    .filter((column) => !pairs.has(column.id))
    .map((column) => column.name);

  const context = contextFor(source);
  const now = nowIso();
  const created: BoardRow[] = [];

  for (const row of targets) {
    const cells = emptyCells(target.board.columns) as Record<string, CellValue>;

    for (const column of source.board.columns) {
      const destination = pairs.get(column.id);
      const value = row.cells[column.id];
      if (!destination || !value) continue;

      cells[destination.id] = convertCell(value, column, destination, context).value;
    }

    target.sequence += 1;
    const moved: BoardRow = {
      id: nextId("row"),
      boardId: target.board.id,
      displayId: formatRowId(target.board.rowIdPrefix, target.sequence),
      sequence: target.sequence,
      cells,
      createdAt: row.createdAt,
      updatedAt: now,
      createdBy: row.createdBy,
      revision: 1,
    };

    target.rows.set(moved.id, moved);
    target.order.push(moved.id);
    logActivity(target, moved.id, `moved ${row.displayId} from ${source.board.name}`, "moved");
    created.push(moved);

    source.rows.delete(row.id);
  }

  const gone = new Set(targets.map((row) => row.id));
  source.order = source.order.filter((id) => !gone.has(id));
  source.activity = source.activity.filter((entry) => !gone.has(entry.rowId));

  return {
    requested: rowIds.length,
    rows: created,
    // The ids the *source* board must forget; `rows` are their new identities.
    applied: [...gone],
    skipped,
    targetBoardId: target.board.id,
    targetNodeId,
    droppedColumns,
  };
}

/* ----------------------------------------------------------------- import */

export interface ImportRowsInput {
  readonly boardId: string;
  /** Already validated and mapped by the wizard — cells keyed by column id. */
  readonly rows: readonly Readonly<Record<string, CellValue>>[];
}

/**
 * Create many records in one call. Record ids come from the board's own
 * counter, so an import lands as `TASK-042 … TASK-141` with no gaps and no
 * client-invented identifiers.
 */
async function importRows(
  { boardId, rows }: ImportRowsInput,
  signal?: AbortSignal,
): Promise<readonly BoardRow[]> {
  await writeDelay(signal);
  const record = recordByBoardId(boardId);
  assertWritable(record, "the import");

  const now = nowIso();
  const created: BoardRow[] = [];

  for (const cells of rows) {
    record.sequence += 1;

    const row: BoardRow = {
      id: nextId("row"),
      boardId: record.board.id,
      displayId: formatRowId(record.board.rowIdPrefix, record.sequence),
      sequence: record.sequence,
      cells: { ...emptyCells(record.board.columns), ...cells },
      createdAt: now,
      updatedAt: now,
      createdBy: CURRENT_USER.id,
      revision: 1,
    };

    record.rows.set(row.id, row);
    record.order.push(row.id);
    logActivity(record, row.id, `imported ${row.displayId}`, "imported");
    created.push(row);
  }

  return created;
}

/* -------------------------------------------------------------- relations */

export interface BoardDescriptor {
  readonly boardId: string;
  readonly nodeId: string;
  readonly name: string;
}

/** Every live board node in the active workspace. Cheap — no seeding. */
function boardNodes(): readonly BoardNode[] {
  return flattenTree(getActiveTree()).filter(
    (node): node is BoardNode => isBoard(node) && !node.isTrashed,
  );
}

/**
 * Boards a relation column can point at. Derived from the tree, so listing
 * them never seeds — a 5.000-record board is not built just to name it.
 */
async function listBoards(signal?: AbortSignal): Promise<readonly BoardDescriptor[]> {
  await readDelay(signal);

  return boardNodes().map((node) => ({
    boardId: boardIdFor(node.id),
    nodeId: node.id,
    name: node.name,
  }));
}

export interface BoardScanEntry {
  readonly node: BoardNode;
  readonly board: Board;
  readonly rows: readonly BoardRow[];
}

export interface ScanOptions {
  /** Permission gate. Boards that fail it are never seeded, let alone read. */
  readonly allow?: (node: BoardNode) => boolean;
}

/**
 * Records across every board, for the workspace-wide readers: global search
 * and My Work.
 *
 * Seeding is cached in the registry, so the first scan pays for the boards it
 * touches once and later scans are map reads.
 */
async function scanBoards(
  { allow }: ScanOptions = {},
  signal?: AbortSignal,
): Promise<readonly BoardScanEntry[]> {
  await readDelay(signal);

  const entries: BoardScanEntry[] = [];

  for (const node of boardNodes()) {
    if (allow && !allow(node)) continue;

    const record = recordFor(node.id);
    entries.push({
      node,
      board: record.board,
      rows: record.order
        .map((id) => record.rows.get(id))
        .filter((row): row is BoardRow => Boolean(row)),
    });
  }

  return entries;
}

export interface RelationTarget {
  readonly rowId: string;
  readonly displayId: string;
  readonly title: string;
  readonly boardId: string;
  readonly boardName: string;
}

/** Every linkable row of a board, for resolving relation chips in one call. */
async function relationIndex(
  boardId: string,
  signal?: AbortSignal,
): Promise<readonly RelationTarget[]> {
  await readDelay(signal);

  const record = recordByBoardId(boardId);
  const primaryId = record.board.primaryColumnId;

  return record.order.flatMap((rowId) => {
    const row = record.rows.get(rowId);
    if (!row) return [];

    const title = row.cells[primaryId];

    return [
      {
        rowId,
        displayId: row.displayId,
        title: title && title.kind === "text" ? title.value : "",
        boardId: record.board.id,
        boardName: record.board.name,
      },
    ];
  });
}

export interface Backlink {
  readonly boardId: string;
  readonly boardNodeId: string;
  readonly boardName: string;
  readonly columnName: string;
  readonly rowId: string;
  readonly displayId: string;
  readonly title: string;
}

/**
 * Rows that point at `rowId` through any relation column.
 *
 * The scan covers boards this session has loaded. A real backend answers this
 * from a link table — see the API report.
 */
async function listBacklinks(rowId: string, signal?: AbortSignal): Promise<readonly Backlink[]> {
  await readDelay(signal);

  const links: Backlink[] = [];

  for (const record of registry.values()) {
    const relationColumns = record.board.columns.filter((column) => column.type === "relation");
    if (relationColumns.length === 0) continue;

    const primaryId = record.board.primaryColumnId;

    for (const sourceId of record.order) {
      const row = record.rows.get(sourceId);
      if (!row) continue;

      for (const column of relationColumns) {
        const value = row.cells[column.id];
        if (!value || value.kind !== "relation" || !value.rowIds.includes(rowId)) continue;

        const title = row.cells[primaryId];
        links.push({
          boardId: record.board.id,
          boardNodeId: record.board.nodeId,
          boardName: record.board.name,
          columnName: column.name,
          rowId: sourceId,
          displayId: row.displayId,
          title: title && title.kind === "text" ? title.value : "",
        });
      }
    }
  }

  return links;
}

/** Test seam: drop cached boards so a fresh tree seeds new records. */
function reset(): void {
  registry.clear();
}

export const boardService = {
  getBoard,
  searchRows,
  createRow,
  duplicateRow,
  deleteRow,
  updateCells,
  bulkUpdate,
  bulkArchive,
  bulkDelete,
  bulkMove,
  importRows,
  createColumn,
  updateColumn,
  reorderColumn,
  deleteColumn,
  convertColumn,
  createSelectOption,
  listBoards,
  scanBoards,
  relationIndex,
  listBacklinks,
  updateView,
  createView,
  deleteView,
  noteActivity,
  listActivity,
  reset,
};

export { prefixForBoard };
