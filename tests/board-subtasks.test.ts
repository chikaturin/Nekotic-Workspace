import { beforeEach, describe, expect, test } from "vitest";
import {
  ancestorIdsOf,
  buildHierarchy,
  childIdsOf,
  completionColumnOf,
  descendantIdsOf,
  isRowCompleted,
  isSubtask,
  layoutHierarchy,
  subtaskProgress,
  wouldCreateCycle,
} from "@/lib/board-hierarchy";
import { flattenGroups, flattenUngrouped } from "@/lib/board-grouping";
import { indexRows, type RowMap } from "@/lib/board-records";
import { resetSimulation, setSimulation } from "@/services/simulation";
import { useBoardStore } from "@/store/board-store";
import { useWorkspaceStore } from "@/store/workspace-store";
import type { BoardColumnOf, BoardRow } from "@/types";
import { buildTestTree, ID, TEST_WORKSPACE } from "./helpers";

/**
 * Task hierarchy.
 *
 * The property under test throughout: a subtask is an ordinary board record
 * that names a parent. Nothing is stored on the parent, so every reader —
 * drawer, table, Kanban badge — derives the same answer from one record set.
 */

const WORKSPACE_ID = "ws_test";

function row(id: string, parentRowId?: string | null): BoardRow {
  return {
    id,
    boardId: "brd",
    displayId: id.toUpperCase(),
    sequence: 1,
    cells: {},
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
    createdBy: "u1",
    revision: 1,
    ...(parentRowId === undefined ? {} : { parentRowId }),
  };
}

/** TASK-001 owns 002 and 003; 003 owns 004. 005 stands alone. */
function fixture(): { rowsById: RowMap; rowOrder: readonly string[] } {
  return indexRows([
    row("r1"),
    row("r2", "r1"),
    row("r3", "r1"),
    row("r4", "r3"),
    row("r5"),
  ]);
}

describe("hierarchy index", () => {
  test("children are grouped under their parent, in board order", () => {
    const { rowsById, rowOrder } = fixture();
    const index = buildHierarchy(rowOrder, rowsById);

    expect(index.rootIds).toEqual(["r1", "r5"]);
    expect(childIdsOf(index, "r1")).toEqual(["r2", "r3"]);
    expect(childIdsOf(index, "r3")).toEqual(["r4"]);
  });

  test("nesting is not capped at one level", () => {
    const { rowsById, rowOrder } = fixture();
    const index = buildHierarchy(rowOrder, rowsById);

    expect(descendantIdsOf(index, "r1")).toEqual(expect.arrayContaining(["r2", "r3", "r4"]));
    expect(ancestorIdsOf(rowsById, "r4")).toEqual(["r3", "r1"]);
  });

  test("a record whose parent is gone becomes a root, not an invisible row", () => {
    const orphaned = indexRows([row("r2", "missing"), row("r5")]);
    const index = buildHierarchy(orphaned.rowOrder, orphaned.rowsById);

    expect(index.rootIds).toEqual(["r2", "r5"]);
  });

  test("a cycle is refused before it can be written", () => {
    const { rowsById } = fixture();

    expect(wouldCreateCycle(rowsById, "r1", "r4")).toBe(true);
    expect(wouldCreateCycle(rowsById, "r1", "r1")).toBe(true);
    expect(wouldCreateCycle(rowsById, "r5", "r1")).toBe(false);
    expect(wouldCreateCycle(rowsById, "r5", null)).toBe(false);
  });
});

describe("subtask progress", () => {
  const status: BoardColumnOf<"select"> = {
    id: "col_status",
    name: "Status",
    position: 1,
    width: 150,
    hidden: false,
    isPrimary: false,
    type: "select",
    config: {
      isMulti: false,
      options: [
        { id: "todo", label: "To do", color: "gray" },
        { id: "done", label: "Done", color: "green" },
      ],
      completedOptionIds: ["done"],
    },
  };

  function withStatus(id: string, parentRowId: string | null, optionId: string): BoardRow {
    return {
      ...row(id, parentRowId),
      cells: { col_status: { kind: "select", optionIds: [optionId] } },
    };
  }

  test("completion is read from the configured options, never from a label", () => {
    const renamed: BoardColumnOf<"select"> = {
      ...status,
      config: {
        ...status.config,
        options: [
          { id: "todo", label: "To do", color: "gray" },
          { id: "done", label: "Shipped", color: "green" },
        ],
      },
    };

    expect(isRowCompleted(withStatus("r2", "r1", "done"), renamed)).toBe(true);
    expect(isRowCompleted(withStatus("r2", "r1", "todo"), renamed)).toBe(false);
  });

  test("2 of 5 completed reports 40 percent", () => {
    const { rowsById } = indexRows([
      row("r1"),
      withStatus("r2", "r1", "done"),
      withStatus("r3", "r1", "done"),
      withStatus("r4", "r1", "todo"),
      withStatus("r5", "r1", "todo"),
      withStatus("r6", "r1", "todo"),
    ]);

    const progress = subtaskProgress(["r2", "r3", "r4", "r5", "r6"], rowsById, status);

    expect(progress).toMatchObject({ total: 5, completed: 2, percent: 40, isMeasurable: true });
  });

  test("with no completed options configured, progress is not measurable", () => {
    const unconfigured: BoardColumnOf<"select"> = {
      ...status,
      config: { ...status.config, completedOptionIds: [] },
    };

    expect(completionColumnOf([unconfigured])).toBeNull();
    expect(subtaskProgress(["r2"], fixture().rowsById, null).isMeasurable).toBe(false);
  });
});

describe("view layout", () => {
  const { rowsById, rowOrder } = fixture();
  const index = buildHierarchy(rowOrder, rowsById);
  const rowIds = [...rowOrder];

  test("nested indents children under their parent", () => {
    const entries = layoutHierarchy({
      rowIds,
      rowsById,
      index,
      display: "nested",
      collapsed: new Set(),
    });

    expect(entries.map((entry) => [entry.rowId, entry.depth])).toEqual([
      ["r1", 0],
      ["r2", 1],
      ["r3", 1],
      ["r4", 2],
      ["r5", 0],
    ]);
  });

  test("a collapsed parent contributes only itself", () => {
    const entries = layoutHierarchy({
      rowIds,
      rowsById,
      index,
      display: "nested",
      collapsed: new Set(["r1"]),
    });

    expect(entries.map((entry) => entry.rowId)).toEqual(["r1", "r5"]);
    expect(entries[0]?.isCollapsed).toBe(true);
    expect(entries[0]?.childCount).toBe(2);
  });

  test("flat shows every record as a top-level row", () => {
    const entries = layoutHierarchy({
      rowIds,
      rowsById,
      index,
      display: "flat",
      collapsed: new Set(),
    });

    expect(entries).toHaveLength(5);
    expect(entries.every((entry) => entry.depth === 0)).toBe(true);
  });

  test("hidden drops subtasks and keeps the roots", () => {
    const entries = layoutHierarchy({
      rowIds,
      rowsById,
      index,
      display: "hidden",
      collapsed: new Set(),
    });

    expect(entries.map((entry) => entry.rowId)).toEqual(["r1", "r5"]);
  });

  test("a child whose parent a filter removed is promoted, never dropped", () => {
    const entries = layoutHierarchy({
      rowIds: ["r2", "r4"],
      rowsById,
      index,
      display: "nested",
      collapsed: new Set(),
    });

    expect(entries.map((entry) => [entry.rowId, entry.depth])).toEqual([
      ["r2", 0],
      ["r4", 0],
    ]);
  });

  test("the flattener carries hierarchy through grouped and ungrouped alike", () => {
    const expand = (ids: readonly string[]) =>
      layoutHierarchy({ rowIds: ids, rowsById, index, display: "nested", collapsed: new Set() });

    const ungrouped = flattenUngrouped(rowIds, expand);
    expect(ungrouped.rowIds).toEqual(["r1", "r2", "r3", "r4", "r5"]);

    const grouped = flattenGroups(
      [{ key: "g", label: "Group", rowIds }],
      new Set(),
      expand,
    );
    const records = grouped.flat.filter((entry) => entry.kind === "record");
    expect(records.map((entry) => (entry.kind === "record" ? entry.depth : -1))).toEqual([
      0, 1, 1, 2, 0,
    ]);
  });
});

/* ------------------------------------------------------------ integration */

describe("subtasks through the store and service", () => {
  beforeEach(async () => {
    resetSimulation();
    setSimulation({ latency: "fast" });

    useWorkspaceStore.setState({
      workspaces: [TEST_WORKSPACE],
      activeWorkspaceId: WORKSPACE_ID,
      treeByWorkspace: { [WORKSPACE_ID]: buildTestTree() },
      feedback: null,
      seed: 0,
    });

    await useBoardStore.getState().load(ID.roadmap);
  });

  function parentId(): string {
    const id = useBoardStore.getState().rowOrder[0];
    if (!id) throw new Error("board did not load");
    return id;
  }

  test("a subtask is a full record with its own display id", async () => {
    const parent = parentId();
    const childId = await useBoardStore.getState().createSubtask(parent);
    expect(childId).toBeTruthy();

    const child = useBoardStore.getState().rowsById[childId!];
    expect(child?.parentRowId).toBe(parent);
    expect(child?.displayId).toMatch(/^TASK-\d+$/);
    expect(child?.displayId).not.toBe(useBoardStore.getState().rowsById[parent]?.displayId);
    expect(child?.revision).toBeGreaterThan(0);
  });

  test("three subtasks all appear under one parent", async () => {
    const parent = parentId();
    const before = childIdsOf(
      buildHierarchy(useBoardStore.getState().rowOrder, useBoardStore.getState().rowsById),
      parent,
    ).length;

    for (const title of ["Create API", "Create UI", "Handle callback"]) {
      await useBoardStore.getState().createSubtask(parent, {
        col_title: { kind: "text", value: title },
      });
    }

    const state = useBoardStore.getState();
    const children = childIdsOf(buildHierarchy(state.rowOrder, state.rowsById), parent);

    expect(children).toHaveLength(before + 3);
    expect(children.every((id) => isSubtask(state.rowsById[id]))).toBe(true);
  });

  test("editing a subtask updates what the parent's panel reads", async () => {
    const parent = parentId();
    const childId = await useBoardStore.getState().createSubtask(parent);
    if (!childId) throw new Error("subtask not created");

    await useBoardStore.getState().editCells([
      { rowId: childId, columnId: "col_status", value: { kind: "select", optionIds: ["status_4"] } },
    ]);

    const state = useBoardStore.getState();
    const status = state.board?.columns.find((column) => column.id === "col_status");
    if (!status || status.type !== "select") throw new Error("fixture is missing Status");

    const children = childIdsOf(buildHierarchy(state.rowOrder, state.rowsById), parent);
    expect(subtaskProgress(children, state.rowsById, status).completed).toBeGreaterThan(0);
  });

  test("deleting a parent keeps its subtasks and lifts them to the top level", async () => {
    const parent = parentId();
    const childId = await useBoardStore.getState().createSubtask(parent);
    if (!childId) throw new Error("subtask not created");

    await useBoardStore.getState().deleteRow(parent);

    const state = useBoardStore.getState();
    expect(state.rowsById[parent]).toBeUndefined();
    expect(state.rowsById[childId]).toBeDefined();
    expect(state.rowsById[childId]?.parentRowId ?? null).toBeNull();
  });

  test("archiving a subtask leaves the hierarchy intact", async () => {
    const parent = parentId();
    const childId = await useBoardStore.getState().createSubtask(parent);
    if (!childId) throw new Error("subtask not created");

    await useBoardStore.getState().bulkArchive([childId], true);

    const state = useBoardStore.getState();
    expect(state.rowsById[childId]?.archivedAt).toBeTruthy();
    expect(state.rowsById[childId]?.parentRowId).toBe(parent);
  });

  test("detaching a subtask keeps the record and clears the pointer", async () => {
    const parent = parentId();
    const childId = await useBoardStore.getState().createSubtask(parent);
    if (!childId) throw new Error("subtask not created");

    const moved = await useBoardStore.getState().setRowParent(childId, null);

    expect(moved).toBe(true);
    expect(useBoardStore.getState().rowsById[childId]?.parentRowId ?? null).toBeNull();
  });

  test("a re-parent that would loop is refused and nothing is written", async () => {
    const parent = parentId();
    const childId = await useBoardStore.getState().createSubtask(parent);
    if (!childId) throw new Error("subtask not created");

    const moved = await useBoardStore.getState().setRowParent(parent, childId);

    expect(moved).toBe(false);
    expect(useBoardStore.getState().rowsById[parent]?.parentRowId ?? null).toBeNull();
  });

  test("subtask relation and Blocked By stay independent", async () => {
    const parent = parentId();
    const childId = await useBoardStore.getState().createSubtask(parent);
    if (!childId) throw new Error("subtask not created");

    // A dependency written on the relation column must not touch containment.
    await useBoardStore.getState().editCells([
      { rowId: childId, columnId: "col_blocks", value: { kind: "relation", rowIds: [parent] } },
    ]);

    const child = useBoardStore.getState().rowsById[childId];
    expect(child?.parentRowId).toBe(parent);
    expect(child?.cells.col_blocks).toEqual({ kind: "relation", rowIds: [parent] });
  });
});
