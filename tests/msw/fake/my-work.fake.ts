import { MY_WORK_WIDGET_LIMIT } from "@/config/app";
import {
  assigneeIds,
  isBeforeDay,
  isDone,
  isSameCalendarDay,
  isWithinDays,
  lensesFor,
  toItem,
  type BoardLenses,
} from "@/lib/my-work";
import { DIRECTORY } from "@/mock/users";
import { readDelay } from "@/services/backend";
import { boardFake } from "./board.fake";
import type { Board, BoardNode, BoardRow, MyWorkItem, MyWorkWidget, MyWorkWidgetId } from "@/types";

/**
 * My Work (CO-MYW-30).
 *
 * Bốn cách đọc CÙNG một tập record — không phải bốn truy vấn, và không có kho
 * "my work" riêng. Mỗi widget là một bộ lọc trên những board người này được
 * xem, nên mất quyền một board là nó biến khỏi cả bốn cùng lúc.
 *
 * Bốn widget ở đây là ĐÚNG bốn widget server trả về: mọi việc được giao cho
 * bạn, chia theo hạn. Bản trước chia theo một trục khác hẳn — `assigned`,
 * `mentioned`, `recentlyUpdated` — nên bộ offline xanh trong khi trang My Work
 * thật tra bảng icon bằng `dueThisWeek` và nhận `undefined`.
 */

/** "Tuần này" = hôm nay + 6 ngày, đúng như `DEADLINE_WEEK_DAYS` phía backend. */
const MY_WORK_WEEK_DAYS = 6;

interface WidgetDefinition {
  readonly id: MyWorkWidgetId;
  readonly label: string;
  readonly description: string;
}

const WIDGETS: readonly WidgetDefinition[] = [
  { id: "overdue", label: "Overdue", description: "Assigned to you and past its due date" },
  { id: "dueToday", label: "Due today", description: "Assigned to you, due today" },
  {
    id: "dueThisWeek",
    label: "Due this week",
    description: "Assigned to you, due within the next seven days",
  },
  {
    id: "unscheduled",
    label: "No due date",
    description: "Assigned to you with nothing scheduled",
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
  const scan = await boardFake.scanBoards(
    allow ? { allow: (node: BoardNode) => allow(node.id) } : {},
    signal,
  );
  await readDelay(signal);

  const people = new Map(DIRECTORY.map((person) => [person.id, person]));

  const dueToday: RowContext[] = [];
  const overdue: RowContext[] = [];
  const dueThisWeek: RowContext[] = [];
  const unscheduled: RowContext[] = [];
  const rowsById = new Map<string, RowContext>();

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
      if (!isMine || !isOpen) continue;

      // Mỗi record đứng ở ĐÚNG MỘT widget: bốn cái này là một phân hoạch theo
      // hạn, không phải bốn bộ lọc chồng lên nhau.
      const due = lenses.due ? dueValue(context) : null;

      if (due === null) unscheduled.push(context);
      else if (isBeforeDay(due, nowIso)) overdue.push(context);
      else if (isSameCalendarDay(due, nowIso)) dueToday.push(context);
      else if (isWithinDays(due, nowIso, MY_WORK_WEEK_DAYS)) dueThisWeek.push(context);
    }
  }

  const byWidget: Readonly<Record<MyWorkWidgetId, readonly MyWorkItem[]>> = {
    overdue: build("overdue", sortByDue(overdue), people),
    dueToday: build("dueToday", sortByDue(dueToday), people),
    dueThisWeek: build("dueThisWeek", sortByDue(dueThisWeek), people),
    unscheduled: build("unscheduled", sortByUpdated(unscheduled), people),
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

export const myWorkFake = { load, WIDGETS };
