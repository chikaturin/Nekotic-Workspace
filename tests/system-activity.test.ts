import { beforeEach, describe, expect, test } from "vitest";
import { MOCK_NOW } from "@/config/app";
import {
  activityTime,
  changeText,
  describeActivity,
  displayValue,
  EMPTY_VALUE_LABEL,
  groupActivityByDay,
} from "@/lib/activity";
import { boardService } from "@/services/board-service";
import { boardIdFor } from "./msw/fake/board.fake";
import { commentService } from "@/services/comment-service";
import { resetSimulation, setSimulation } from "@/services/simulation";
import { rowRef } from "@/lib/entity-ref";
import { directoryAt } from "@/mock/users";
import { useBoardStore } from "@/store/board-store";
import { useWorkspaceStore } from "@/store/workspace-store";
import type { ActivityEntry, BoardColumnOf } from "@/types";
import { buildTestTree, csvFile, ID, mapToColumns, TEST_WORKSPACE } from "./helpers";

/**
 * SY-ACT-40 — record history.
 *
 * The log has to be structured (column, before, after) so the drawer can render
 * `Doing → Done` without ever putting a payload in front of a person, and one
 * write has to produce one entry however many fields it touched.
 */

const WORKSPACE_ID = "ws_test";
const ROADMAP_BOARD = boardIdFor(ID.roadmap);
const rowIdAt = (index: number) => `${ROADMAP_BOARD}_row_${index}`;

async function loadBoard() {
  await useBoardStore.getState().load(ID.roadmap);
  const board = useBoardStore.getState().board;
  if (!board) throw new Error("board did not load");
  return board;
}

function selectColumn(name: string): BoardColumnOf<"select"> {
  const column = useBoardStore
    .getState()
    .board?.columns.find((candidate) => candidate.name === name);
  if (!column || column.type !== "select") throw new Error(`no select column named ${name}`);
  return column;
}

const entry = (overrides: Partial<ActivityEntry>): ActivityEntry => ({
  id: "act_1",
  rowId: "row_1",
  kind: "updated",
  actor: directoryAt(0),
  summary: "changed Status",
  changes: [],
  createdAt: MOCK_NOW,
  ...overrides,
});

beforeEach(() => {
  resetSimulation();
  setSimulation({ latency: "fast" });

  useWorkspaceStore.setState({
    workspaces: [TEST_WORKSPACE],
      activeWorkspaceId: WORKSPACE_ID,
    treeByWorkspace: { [WORKSPACE_ID]: buildTestTree() },
    trashByWorkspace: { [WORKSPACE_ID]: [] },
    feedback: null,
    seed: 0,
  });

  useBoardStore.setState({
    nodeId: null,
    status: "idle",
    error: null,
    board: null,
    rowsById: {},
    rowOrder: [],
    people: [],
    activeViewId: null,
    search: "",
    pendingWrites: 0,
    conflicts: [],
    isShowingArchived: false,
  });
});

describe("what the log records", () => {
  test("an edit is stored as the column, the old text and the new text", async () => {
    const board = await loadBoard();
    const status = selectColumn("Status");
    const [first, second] = status.config.options;
    if (!first || !second) throw new Error("status column needs two options");

    await boardService.updateCells({
      boardId: board.id,
      edits: [{ rowId: rowIdAt(1), columnId: status.id, value: { kind: "select", optionIds: [second.id] } }],
    });

    const [latest] = await boardService.listActivity(board.id, rowIdAt(1));

    expect(latest?.kind).toBe("updated");
    expect(latest?.summary).toBe("changed Status");
    expect(latest?.changes).toHaveLength(1);
    expect(latest?.changes[0]?.columnName).toBe("Status");
    expect(latest?.changes[0]?.to).toBe(second.label);
    // The stored value is text the column itself renders — never an id.
    expect(latest?.changes[0]?.to).not.toContain("opt_");
  });

  test("changing several fields at once is one entry, not one per field", async () => {
    const board = await loadBoard();
    const status = selectColumn("Status");
    const titleId = board.columns.find((column) => column.name === "Title")!.id;

    const before = (await boardService.listActivity(board.id, rowIdAt(1))).length;

    await boardService.updateCells({
      boardId: board.id,
      edits: [
        { rowId: rowIdAt(1), columnId: titleId, value: { kind: "text", value: "Renamed" } },
        {
          rowId: rowIdAt(1),
          columnId: status.id,
          value: { kind: "select", optionIds: [status.config.options[1]!.id] },
        },
      ],
    });

    const after = await boardService.listActivity(board.id, rowIdAt(1));

    expect(after.length).toBe(before + 1);
    expect(after[0]?.summary).toBe("changed 2 fields");
    expect(after[0]?.changes).toHaveLength(2);
  });

  test("a write that changes nothing records no change rows", async () => {
    const board = await loadBoard();
    const titleId = board.columns.find((column) => column.name === "Title")!.id;
    const current = useBoardStore.getState().rowsById[rowIdAt(1)]?.cells[titleId];
    if (!current || current.kind !== "text") throw new Error("expected a text title");

    await boardService.updateCells({
      boardId: board.id,
      edits: [{ rowId: rowIdAt(1), columnId: titleId, value: { kind: "text", value: current.value } }],
    });

    const [latest] = await boardService.listActivity(board.id, rowIdAt(1));
    expect(latest?.changes).toHaveLength(0);
    expect(latest?.summary).toContain("updated");
  });

  test("a bulk write logs each record it touched", async () => {
    const board = await loadBoard();
    const status = selectColumn("Status");

    await boardService.bulkUpdate({
      boardId: board.id,
      rowIds: [rowIdAt(1), rowIdAt(2)],
      values: { [status.id]: { kind: "select", optionIds: [status.config.options[2]!.id] } },
    });

    for (const rowId of [rowIdAt(1), rowIdAt(2)]) {
      const [latest] = await boardService.listActivity(board.id, rowId);
      expect(latest?.changes[0]?.columnName).toBe("Status");
    }
  });

  test("archiving and restoring are on the record too", async () => {
    const board = await loadBoard();

    await boardService.bulkArchive({ boardId: board.id, rowIds: [rowIdAt(1)], isArchived: true });
    await boardService.bulkArchive({ boardId: board.id, rowIds: [rowIdAt(1)], isArchived: false });

    const kinds = (await boardService.listActivity(board.id, rowIdAt(1))).map((item) => item.kind);
    expect(kinds).toContain("archived");
    expect(kinds).toContain("restored");
  });

  test("re-archiving something already archived does not log twice", async () => {
    const board = await loadBoard();

    await boardService.bulkArchive({ boardId: board.id, rowIds: [rowIdAt(1)], isArchived: true });
    await boardService.bulkArchive({ boardId: board.id, rowIds: [rowIdAt(1)], isArchived: true });

    const archived = (await boardService.listActivity(board.id, rowIdAt(1))).filter(
      (item) => item.kind === "archived",
    );
    expect(archived).toHaveLength(1);
  });

  test("an imported record starts with its own history", async () => {
    const board = await loadBoard();
    const titleId = board.columns.find((column) => column.name === "Title")!.id;
    const outcome = await boardService.importRows({
      boardId: board.id,
      file: csvFile("one.csv", [["Title"], ["From a file"]]),
      mappings: mapToColumns([titleId]),
      invalidPolicy: "skip",
    });

    const history = await boardService.listActivity(board.id, outcome.rowIds[0]!);
    expect(history.some((item) => item.kind === "imported")).toBe(true);
  });

  test("comments land in the same stream as edits", async () => {
    const board = await loadBoard();
    const target = rowRef({
      nodeId: ID.roadmap,
      boardId: board.id,
      rowId: rowIdAt(1),
      label: "TASK-001",
    });

    await commentService.add({ target, body: "Looks ready to me" });

    const history = await boardService.listActivity(board.id, rowIdAt(1));
    expect(history.some((item) => item.kind === "commented")).toBe(true);
  });

  test("deleting a record takes its history with it", async () => {
    const board = await loadBoard();

    await boardService.updateCells({
      boardId: board.id,
      edits: [
        {
          rowId: rowIdAt(1),
          columnId: board.primaryColumnId,
          value: { kind: "text", value: "Doomed" },
        },
      ],
    });

    await boardService.bulkDelete({ boardId: board.id, rowIds: [rowIdAt(1)] });

    expect(await boardService.listActivity(board.id, rowIdAt(1))).toHaveLength(0);
  });
});

describe("reading the log", () => {
  test("an empty value renders as a dash on either side of the arrow", () => {
    expect(displayValue("")).toBe(EMPTY_VALUE_LABEL);
    expect(displayValue("  ")).toBe(EMPTY_VALUE_LABEL);
    expect(changeText({ columnName: "Status", from: "", to: "Done" })).toBe("— → Done");
  });

  test("an entry describes itself in one sentence, values included", () => {
    const described = describeActivity(
      entry({ changes: [{ columnName: "Status", from: "Doing", to: "Done" }] }),
    );

    expect(described).toContain("changed Status");
    expect(described).toContain("Doing → Done");
    expect(described).not.toContain("{");
  });

  test("an entry with no field changes still reads as a sentence", () => {
    expect(describeActivity(entry({ summary: "created TASK-001", kind: "created" }))).toMatch(
      /created TASK-001$/,
    );
  });

  test("the timeline groups by day, newest first, and names today", () => {
    const yesterday = "2026-08-25T16:20:00.000Z";
    const days = groupActivityByDay(
      [
        entry({ id: "a", createdAt: yesterday }),
        entry({ id: "b", createdAt: MOCK_NOW }),
        entry({ id: "c", createdAt: "2026-08-25T16:15:00.000Z" }),
      ],
      MOCK_NOW,
    );

    expect(days.map((day) => day.label)).toEqual(["Today", "Yesterday"]);
    expect(days[1]?.entries.map((item) => item.id)).toEqual(["a", "c"]);
  });

  test("older days fall back to a plain date", () => {
    const days = groupActivityByDay([entry({ createdAt: "2026-07-04T09:00:00.000Z" })], MOCK_NOW);
    expect(days[0]?.label).toBe("04 Jul 2026");
  });

  test("the time column is a clock reading, not a relative label", () => {
    expect(activityTime("2026-08-26T16:20:00.000Z")).toMatch(/^\d{2}:\d{2}$/);
  });
});
