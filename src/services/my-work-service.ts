import { MY_WORK_WIDGET_LIMIT } from "@/config/app";
import {
  assigneeIds,
  isBeforeDay,
  isDone,
  isSameCalendarDay,
  lensesFor,
  toItem,
  type BoardLenses,
} from "@/lib/my-work";
import { DIRECTORY } from "@/mock/users";
import { readDelay } from "@/services/backend";
import { boardService } from "@/services/board-service";
import { commentService } from "@/services/comment-service";
import { watchService } from "@/services/watch-service";
import type { Board, BoardNode, BoardRow, MyWorkItem, MyWorkWidget, MyWorkWidgetId } from "@/types";

/**
 * My Work (CO-MYW-30).
 *
 * Five readings of the same record set — never five queries and never a
 * separate "my work" store. Each widget is a filter over the boards the user
 * is allowed to see, so a board they lose access to disappears from all five
 * at once.
 */

const RECENT_WINDOW_MS = 7 * 86_400_000;

interface WidgetDefinition {
  readonly id: MyWorkWidgetId;
  readonly label: string;
  readonly description: string;
}

const WIDGETS: readonly WidgetDefinition[] = [
  { id: "assigned", label: "Assigned to me", description: "Open records with your name on them" },
  { id: "mentioned", label: "Mentioned", description: "Threads that called you in" },
  { id: "dueToday", label: "Due today", description: "Deadlines landing on today" },
  { id: "overdue", label: "Overdue", description: "Past their deadline and still open" },
  {
    id: "recentlyUpdated",
    label: "Recently updated",
    description: "Your records touched in the last 7 days",
  },
] as const;

export interface MyWorkInput {
  readonly userId: string;
  /**
   * Permission gate, keyed by drive node id. Applied before a board is read at
   * all, and again to the target of every mention — a comment on something the
   * user cannot open must not surface here either.
   */
  readonly allow?: (nodeId: string) => boolean;
  /** Reference instant — the frozen clock in fixtures, `now` in production. */
  readonly nowIso: string;
  readonly limit?: number;
}

interface RowContext {
  readonly nodeId: string;
  readonly boardName: string;
  readonly board: Board;
  readonly row: BoardRow;
  readonly lenses: BoardLenses;
}

async function load(
  { userId, allow, nowIso, limit = MY_WORK_WIDGET_LIMIT }: MyWorkInput,
  signal?: AbortSignal,
): Promise<readonly MyWorkWidget[]> {
  const scan = await boardService.scanBoards(
    allow ? { allow: (node: BoardNode) => allow(node.id) } : {},
    signal,
  );
  await readDelay(signal);

  const people = new Map(DIRECTORY.map((person) => [person.id, person]));
  const watched = new Set(
    (await watchService.list(userId, signal)).map((entry) => entry.ref.rowId ?? ""),
  );

  const assigned: RowContext[] = [];
  const dueToday: RowContext[] = [];
  const overdue: RowContext[] = [];
  const recent: RowContext[] = [];
  const rowsById = new Map<string, RowContext>();

  const horizon = Date.parse(nowIso) - RECENT_WINDOW_MS;

  for (const entry of scan) {
    const lenses = lensesFor(entry.board);

    for (const row of entry.rows) {
      const context: RowContext = {
        nodeId: entry.node.id,
        boardName: entry.node.name,
        board: entry.board,
        row,
        lenses,
      };
      rowsById.set(row.id, context);

      const isMine = assigneeIds(row, lenses).includes(userId);
      const isOpen = !isDone(row, lenses);
      const due = lenses.due ? dueValue(context) : null;

      if (isMine && isOpen) assigned.push(context);
      if (isMine && isOpen && isSameCalendarDay(due, nowIso)) dueToday.push(context);
      if (isMine && isOpen && isBeforeDay(due, nowIso)) overdue.push(context);

      const isFollowed = isMine || row.createdBy === userId || watched.has(row.id);
      if (isFollowed && Date.parse(row.updatedAt) >= horizon) recent.push(context);
    }
  }

  const mentioned = mentionedItems(userId, rowsById, people, allow);

  const byWidget: Readonly<Record<MyWorkWidgetId, readonly MyWorkItem[]>> = {
    assigned: build("assigned", sortByDue(assigned), people),
    mentioned,
    dueToday: build("dueToday", sortByDue(dueToday), people),
    overdue: build("overdue", sortByDue(overdue), people),
    recentlyUpdated: build("recentlyUpdated", sortByUpdated(recent), people),
  };

  return WIDGETS.map((definition) => {
    const items = byWidget[definition.id];
    return {
      id: definition.id,
      label: definition.label,
      description: definition.description,
      items: items.slice(0, limit),
      total: items.length,
    };
  });
}

function dueValue(context: RowContext): string | null {
  if (!context.lenses.due) return null;
  const value = context.row.cells[context.lenses.due.id];
  return value && value.kind === "date" ? value.iso : null;
}

function sortByDue(rows: readonly RowContext[]): readonly RowContext[] {
  return [...rows].sort((a, b) => {
    const left = dueValue(a);
    const right = dueValue(b);

    // Records without a deadline sink below the ones that have one.
    if (left === null && right === null) return Date.parse(b.row.updatedAt) - Date.parse(a.row.updatedAt);
    if (left === null) return 1;
    if (right === null) return -1;

    return Date.parse(left) - Date.parse(right);
  });
}

function sortByUpdated(rows: readonly RowContext[]): readonly RowContext[] {
  return [...rows].sort((a, b) => Date.parse(b.row.updatedAt) - Date.parse(a.row.updatedAt));
}

function build(
  widgetId: MyWorkWidgetId,
  rows: readonly RowContext[],
  people: ReadonlyMap<string, import("@/types").DirectoryUser>,
): readonly MyWorkItem[] {
  return rows.map((context) =>
    toItem({
      widgetId,
      nodeId: context.nodeId,
      boardName: context.boardName,
      board: context.board,
      row: context.row,
      lenses: context.lenses,
      people,
    }),
  );
}

/**
 * Threads that named the user. A mention on a record resolves to that record;
 * a mention on a page keeps the page as its own row in the widget.
 */
function mentionedItems(
  userId: string,
  rowsById: ReadonlyMap<string, RowContext>,
  people: ReadonlyMap<string, import("@/types").DirectoryUser>,
  allow: ((nodeId: string) => boolean) | undefined,
): readonly MyWorkItem[] {
  const seen = new Set<string>();
  const items: MyWorkItem[] = [];

  for (const comment of commentService.listMentioning(userId)) {
    if (allow && !allow(comment.target.nodeId)) continue;
    if (seen.has(comment.targetKey)) continue;
    seen.add(comment.targetKey);

    if (comment.target.kind === "row") {
      const context = comment.target.rowId ? rowsById.get(comment.target.rowId) : undefined;

      // A record whose board the permission gate excluded — or that has since
      // been deleted — is dropped. It must never fall through to the page
      // branch, which would name and link a record the user cannot open.
      if (!context) continue;

      items.push({
        ...toItem({
          widgetId: "mentioned",
          nodeId: context.nodeId,
          boardName: context.boardName,
          board: context.board,
          row: context.row,
          lenses: context.lenses,
          people,
        }),
        updatedAt: comment.createdAt,
      });
      continue;
    }

    items.push({
      id: `mentioned:${comment.id}`,
      ref: comment.target,
      displayId: "",
      title: comment.target.label,
      boardName: comment.author.name,
      statusLabel: null,
      statusColor: null,
      dueIso: null,
      updatedAt: comment.createdAt,
      assignees: [],
    });
  }

  return items;
}

export const myWorkService = { load, WIDGETS };
