import { beforeEach, describe, expect, test } from "vitest";
import { countFilledCells } from "@/lib/board-records";
import {
  findColumnByName,
  insertColumnAt,
  isProtectedColumn,
  makeColumn,
  removeColumn,
  uniqueColumnName,
} from "@/lib/board-schema";
import {
  autoFitWidth,
  AUTO_FIT_MAX_WIDTH,
  estimateLines,
  heightForLines,
  isFlexibleColumn,
  WRAP_MAX_LINES,
} from "@/lib/cell-display";
import { isGridKeyTarget, isHeaderTarget, isTypingTarget } from "@/lib/dom/typing-target";
import { prefixOffsets, variableScrollOffsetFor, variableWindowRange } from "@/lib/grid-geometry";
import {
  canFormatSteps,
  DEFAULT_STEP_NUMBERING,
  formatSteps,
  lineAt,
  looksLikeSteps,
  nextStepInsertion,
  numberPastedLines,
  openingText,
  parseStepLine,
  spacesAfter,
  stepNumberingOf,
  stepToken,
} from "@/lib/step-numbering";
import { MEMBERS } from "@/mock/users";
import { boardService } from "@/services/board-service";
import { ServiceError } from "@/services/errors";
import { resetSimulation, setSimulation } from "@/services/simulation";
import { useBoardStore } from "@/store/board-store";
import { useGridStore } from "@/store/grid-store";
import { useWorkspaceStore } from "@/store/workspace-store";
import type { BoardRow, CellValue, StepNumbering, WorkspaceRole } from "@/types";
import { buildTestTree, ID, TEST_WORKSPACE } from "./helpers";

/**
 * Dynamic columns.
 *
 * The board's schema is user data: columns are added, renamed, reordered,
 * retyped and removed while people are working in them. These cover the four
 * things that has to keep being true — a column is only as permanent as its
 * role demands, its name is unambiguous, its position is a position and not an
 * array index, and how a view *shows* it never changes what it *is*.
 */

const WORKSPACE_ID = "ws_test";
const boardId = `brd_${ID.roadmap}`;

function signedInAs(role: WorkspaceRole) {
  useWorkspaceStore.setState({
    workspaces: [
      {
        ...TEST_WORKSPACE,
        members: MEMBERS.map((member, index) => (index === 0 ? { ...member, role } : member)),
      },
    ],
    activeWorkspaceId: WORKSPACE_ID,
    treeByWorkspace: { [WORKSPACE_ID]: buildTestTree() },
    trashByWorkspace: { [WORKSPACE_ID]: [] },
    feedback: null,
    seed: 0,
  });
}

beforeEach(() => {
  resetSimulation();
  setSimulation({ latency: "fast" });
  boardService.reset();
  useGridStore.getState().reset();
  signedInAs("admin");
});

async function loadBoard() {
  await useBoardStore.getState().load(ID.roadmap);
  const board = useBoardStore.getState().board;
  if (!board) throw new Error("board did not load");
  return board;
}

const names = () =>
  [...(useBoardStore.getState().board?.columns ?? [])]
    .sort((a, b) => a.position - b.position)
    .map((column) => column.name);

/* ---------------------------------------------------------------------- T1 */

describe("what makes a column permanent", () => {
  test("only the column that titles a record is protected", async () => {
    const board = await loadBoard();

    const protectedColumns = board.columns.filter(isProtectedColumn);
    expect(protectedColumns).toHaveLength(1);
    expect(protectedColumns[0]?.id).toBe(board.primaryColumnId);
  });

  test("no column carries a flag that would freeze it", async () => {
    const board = await loadBoard();

    for (const column of board.columns) {
      const keys = Object.keys(column);
      expect(keys).not.toContain("locked");
      expect(keys).not.toContain("system");
      expect(keys).not.toContain("protected");
      expect(keys).not.toContain("isImported");
    }
  });

  test("a column added after the board was made deletes like any other", async () => {
    await loadBoard();
    const store = () => useBoardStore.getState();

    const created = await store().addColumn("text", "Temp");
    expect(created).not.toBeNull();
    expect(names()).toContain("Temp");

    await store().deleteColumn(created!.id);
    expect(names()).not.toContain("Temp");
  });

  test("deleting a column takes its value off every record", async () => {
    const board = await loadBoard();
    const store = () => useBoardStore.getState();

    const created = await store().addColumn("text", "Scratch");
    const rowId = store().rowOrder[0]!;
    await store().editCells([
      { rowId, columnId: created!.id, value: { kind: "text", value: "noted" } },
    ]);

    expect(store().rowsById[rowId]?.cells[created!.id]).toBeDefined();

    await store().deleteColumn(created!.id);
    const server = await boardService.getBoard(ID.roadmap);
    expect(server.rows.every((row: BoardRow) => !(created!.id in row.cells))).toBe(true);
    expect(board.columns.length).toBe(names().length);
  });

  test("the service refuses to delete the record's own title column", async () => {
    const board = await loadBoard();

    await expect(boardService.deleteColumn(boardId, board.primaryColumnId)).rejects.toBeInstanceOf(
      ServiceError,
    );
  });

  test("removeColumn leaves the schema renumbered with no gaps", () => {
    const columns = [
      makeColumn("a", "A", "text", 0, { isPrimary: true }),
      makeColumn("b", "B", "text", 1),
      makeColumn("c", "C", "text", 2),
    ];

    expect(removeColumn(columns, "b").map((column) => column.position)).toEqual([0, 1]);
  });

  test("the confirmation counts the records that actually hold a value", async () => {
    await loadBoard();
    const store = () => useBoardStore.getState();

    const created = await store().addColumn("text", "Note old");
    const [first, second] = store().rowOrder;

    await store().editCells([
      { rowId: first!, columnId: created!.id, value: { kind: "text", value: "kept" } },
      { rowId: second!, columnId: created!.id, value: { kind: "text", value: "" } },
    ]);

    const { rowsById, rowOrder } = store();
    expect(countFilledCells(rowsById, rowOrder, created!.id)).toBe(1);
  });
});

describe("who may reshape a board", () => {
  test("a manager may add and delete columns", async () => {
    signedInAs("manager");

    const created = await boardService.createColumn(boardId, "text", "Managed");
    await expect(boardService.deleteColumn(boardId, created.id)).resolves.toBeDefined();
  });

  test("a member is refused by the service, not merely by the UI", async () => {
    signedInAs("admin");
    const created = await boardService.createColumn(boardId, "text", "Managed");

    signedInAs("member");
    await expect(boardService.createColumn(boardId, "text", "Sneaky")).rejects.toBeInstanceOf(
      ServiceError,
    );
    await expect(boardService.deleteColumn(boardId, created.id)).rejects.toBeInstanceOf(
      ServiceError,
    );
    await expect(boardService.reorderColumn(boardId, created.id, 0)).rejects.toBeInstanceOf(
      ServiceError,
    );
    await expect(boardService.convertColumn(boardId, created.id, "date")).rejects.toBeInstanceOf(
      ServiceError,
    );
  });

  test("a viewer may not either", async () => {
    signedInAs("viewer");
    await expect(boardService.createColumn(boardId, "text", "Nope")).rejects.toBeInstanceOf(
      ServiceError,
    );
  });
});

/* ---------------------------------------------------------------------- T2 */

describe("a column's configuration is its own", () => {
  test("two select columns hold separate option lists", async () => {
    await loadBoard();
    const store = () => useBoardStore.getState();

    const role = await store().addColumn("select", "Role");
    await store().updateColumnConfig(role!.id, {
      config: { options: [{ id: "o_mgr", label: "Manager", color: "blue" }], isMulti: false },
    });

    const priority = await store().addColumn("select", "Severity");
    await store().updateColumnConfig(priority!.id, {
      config: { options: [{ id: "o_high", label: "High", color: "red" }], isMulti: false },
    });

    const read = (columnId: string) => {
      const column = store().board?.columns.find((candidate) => candidate.id === columnId);
      return column?.type === "select" ? column.config.options.map((option) => option.label) : null;
    };

    expect(read(role!.id)).toEqual(["Manager"]);
    expect(read(priority!.id)).toEqual(["High"]);

    // Editing one leaves the other exactly where it was.
    await store().updateColumnConfig(role!.id, {
      config: {
        options: [
          { id: "o_mgr", label: "Manager", color: "blue" },
          { id: "o_mem", label: "Member", color: "green" },
        ],
        isMulti: false,
      },
    });

    expect(read(role!.id)).toEqual(["Manager", "Member"]);
    expect(read(priority!.id)).toEqual(["High"]);

    // And deleting one leaves the other working.
    await store().deleteColumn(role!.id);
    expect(read(priority!.id)).toEqual(["High"]);
  });

  test("converting a column gives it that type's own defaults, not its neighbour's", async () => {
    await loadBoard();
    const store = () => useBoardStore.getState();

    const created = await store().addColumn("text", "Environment");
    await store().convertColumn(created!.id, "select");

    const column = store().board?.columns.find((candidate) => candidate.id === created!.id);
    expect(column?.type).toBe("select");
    expect(column?.type === "select" ? column.config.options : null).toEqual([]);
  });
});

describe("column names stay unambiguous", () => {
  test("a new column takes a name nothing else is using", async () => {
    await loadBoard();

    const first = await boardService.createColumn(boardId, "text", "Notes");
    const second = await boardService.createColumn(boardId, "text", "Notes");

    expect(first.name).toBe("Notes");
    expect(second.name).toBe("Notes 2");
  });

  test("a rename onto a name already in use is refused, and nothing changes", async () => {
    await loadBoard();
    const store = () => useBoardStore.getState();

    const created = await store().addColumn("text", "Temp");
    const ok = await store().renameColumn(created!.id, "Status");

    expect(ok).toBe(false);
    expect(names()).toContain("Temp");
    expect(names().filter((name) => name === "Status")).toHaveLength(1);
  });

  test("an empty or unchanged name is not a rename", async () => {
    await loadBoard();
    const store = () => useBoardStore.getState();

    const created = await store().addColumn("text", "Temp");

    expect(await store().renameColumn(created!.id, "   ")).toBe(false);
    expect(await store().renameColumn(created!.id, "Temp")).toBe(false);
    expect(await store().renameColumn(created!.id, "Test Step")).toBe(true);
    expect(names()).toContain("Test Step");
  });

  test("names collide on case and punctuation, not on exact text", () => {
    const columns = [makeColumn("a", "Blocked by", "text", 0)];

    expect(findColumnByName(columns, "blocked-by")?.id).toBe("a");
    expect(findColumnByName(columns, "Blocked by", "a")).toBeUndefined();
    expect(uniqueColumnName(columns, "Blocked by")).toBe("Blocked by 2");
  });
});

/* ---------------------------------------------------------------------- T3 */

describe("keys typed into the header belong to the header", () => {
  test("a text field's keystrokes are not the grid's", () => {
    expect(isTypingTarget({ tagName: "INPUT" })).toBe(true);
    expect(isTypingTarget({ tagName: "TEXTAREA" })).toBe(true);
    expect(isTypingTarget({ tagName: "SELECT" })).toBe(true);
    expect(isTypingTarget({ tagName: "DIV", isContentEditable: true })).toBe(true);
    expect(isTypingTarget({ tagName: "DIV" })).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
  });

  test("anything inside a column header is the header's", () => {
    const inHeader = { tagName: "BUTTON", closest: (selector: string) => (selector === '[role="columnheader"]' ? {} : null) };
    const inCell = { tagName: "BUTTON", closest: () => null };

    expect(isHeaderTarget(inHeader)).toBe(true);
    expect(isHeaderTarget(inCell)).toBe(false);

    expect(isGridKeyTarget(inHeader)).toBe(false);
    expect(isGridKeyTarget(inCell)).toBe(true);
    expect(isGridKeyTarget({ tagName: "INPUT", closest: () => null })).toBe(false);
  });

  test("renaming is addressed by column id, never by position", async () => {
    await loadBoard();
    const store = () => useBoardStore.getState();

    // The column added last is reached exactly like the first one.
    const created = await store().addColumn("text", "Last one");
    useGridStore.getState().beginColumnRename(created!.id);

    expect(useGridStore.getState().renamingColumnId).toBe(created!.id);

    useGridStore.getState().endColumnRename();
    expect(useGridStore.getState().renamingColumnId).toBeNull();
  });

  test("opening a rename closes any cell editor", () => {
    const grid = useGridStore.getState();
    grid.beginEdit("row_1", "col_title");
    expect(useGridStore.getState().editing).not.toBeNull();

    useGridStore.getState().beginColumnRename("col_title");
    expect(useGridStore.getState().editing).toBeNull();
  });
});

/* ---------------------------------------------------------------------- T4 */

describe("inserting a column beside another", () => {
  test("insert left puts it before the anchor", async () => {
    await loadBoard();
    const store = () => useBoardStore.getState();

    const before = names();
    const anchor = store().board!.columns.find((column) => column.name === "Status")!;

    await store().addColumn("text", "Left one", anchor.position);

    const after = names();
    expect(after[anchor.position]).toBe("Left one");
    expect(after[anchor.position + 1]).toBe("Status");
    expect(after).toHaveLength(before.length + 1);
  });

  test("insert right puts it after the anchor", async () => {
    await loadBoard();
    const store = () => useBoardStore.getState();

    const anchor = store().board!.columns.find((column) => column.name === "Status")!;
    await store().addColumn("text", "Right one", anchor.position + 1);

    const after = names();
    expect(after[anchor.position]).toBe("Status");
    expect(after[anchor.position + 1]).toBe("Right one");
  });

  test("the order the board persists is the order the insert asked for", async () => {
    await loadBoard();
    const store = () => useBoardStore.getState();

    const anchor = store().board!.columns.find((column) => column.name === "Status")!;
    await store().addColumn("text", "Wedged", anchor.position);

    const server = await boardService.getBoard(ID.roadmap);
    const ordered = [...server.board.columns]
      .sort((a, b) => a.position - b.position)
      .map((column) => column.name);

    expect(ordered[anchor.position]).toBe("Wedged");
    // Every position is still a distinct, gapless index.
    expect(server.board.columns.map((column) => column.position).sort((a, b) => a - b)).toEqual(
      ordered.map((_, index) => index),
    );
  });

  test("insertColumnAt clamps rather than leaving a hole", () => {
    const columns = [
      makeColumn("a", "A", "text", 0),
      makeColumn("b", "B", "text", 1),
      makeColumn("c", "C", "text", 2),
    ];
    const fresh = makeColumn("n", "New", "text", 0);

    expect(insertColumnAt(columns, fresh, 1).map((column) => column.name)).toEqual([
      "A",
      "New",
      "B",
      "C",
    ]);
    expect(insertColumnAt(columns, fresh, 99).map((column) => column.name)).toEqual([
      "A",
      "B",
      "C",
      "New",
    ]);
    expect(insertColumnAt(columns, fresh, -5).map((column) => column.position)).toEqual([
      0, 1, 2, 3,
    ]);
  });

  test("duplicating a column copies its configuration and its values", async () => {
    const board = await loadBoard();
    const store = () => useBoardStore.getState();

    const source = board.columns.find((column) => column.name === "Status")!;
    const rowId = store().rowOrder[0]!;
    const before = store().rowsById[rowId]?.cells[source.id];

    const copy = await store().duplicateColumn(source.id);

    expect(copy?.type).toBe("select");
    expect(copy?.name).toBe("Status 2");
    expect(copy?.isPrimary).toBe(false);
    expect(copy?.position).toBe(source.position + 1);
    expect(copy?.type === "select" ? copy.config.options.length : 0).toBeGreaterThan(0);
    expect(store().rowsById[rowId]?.cells[copy!.id]).toEqual(before);
  });

  test("a duplicate of the title column is not itself a title column", async () => {
    const board = await loadBoard();

    const copy = await boardService.duplicateColumn(boardId, board.primaryColumnId);
    expect(copy.column.isPrimary).toBe(false);
  });
});

/* ---------------------------------------------------------------------- T5 */

describe("how much of a cell a view shows", () => {
  test("only text can use more than one line", () => {
    expect(isFlexibleColumn(makeColumn("a", "Step", "longText", 0))).toBe(true);
    expect(isFlexibleColumn(makeColumn("b", "Title", "text", 1))).toBe(true);
    expect(isFlexibleColumn(makeColumn("c", "Status", "select", 2))).toBe(false);
    expect(isFlexibleColumn(makeColumn("d", "Due", "date", 3))).toBe(false);
  });

  test("compact is always one line, however long the value", () => {
    expect(estimateLines("x".repeat(2000), 180, "compact")).toBe(1);
    expect(heightForLines(1, 44)).toBe(44);
  });

  test("wrap grows with the content and then stops", () => {
    const short = estimateLines("Open the login page", 180, "wrap");
    const long = estimateLines("x".repeat(2000), 180, "wrap");

    expect(short).toBeGreaterThanOrEqual(1);
    expect(short).toBeLessThan(WRAP_MAX_LINES);
    expect(long).toBe(WRAP_MAX_LINES);
  });

  test("full keeps going where wrap would have stopped", () => {
    const text = Array.from({ length: 12 }, (_, index) => `B${index + 1}: step`).join("\n");

    expect(estimateLines(text, 180, "wrap")).toBe(WRAP_MAX_LINES);
    expect(estimateLines(text, 180, "full")).toBe(12);
  });

  test("hard newlines count as lines even when each is short", () => {
    expect(estimateLines("a\nb\nc", 400, "full")).toBe(3);
  });

  test("a wider column needs fewer lines for the same text", () => {
    const text = "x".repeat(300);
    expect(estimateLines(text, 400, "full")).toBeLessThan(estimateLines(text, 120, "full"));
  });

  test("a multi-line row is taller than the view's own height, never shorter", () => {
    expect(heightForLines(4, 32)).toBeGreaterThan(32);
    expect(heightForLines(1, 68)).toBe(68);
    expect(heightForLines(2, 200)).toBe(200);
  });

  test("auto fit sizes to the longest line and stays inside its bounds", () => {
    const narrow = autoFitWidth(["ok", "fine"], "Step");
    const wide = autoFitWidth(["x".repeat(5000)], "Step");

    expect(narrow).toBeLessThan(wide);
    expect(wide).toBeLessThanOrEqual(AUTO_FIT_MAX_WIDTH);

    // A value with newlines is measured by its longest line, not its length.
    const wrapped = autoFitWidth([Array.from({ length: 40 }, () => "short").join("\n")], "Step");
    expect(wrapped).toBeLessThan(wide);
  });
});

describe("virtualising rows that are not all the same height", () => {
  test("running tops are the sum of everything above", () => {
    expect(prefixOffsets([10, 20, 30])).toEqual([0, 10, 30, 60]);
    expect(prefixOffsets([])).toEqual([0]);
  });

  test("the window covers the viewport and no more than the overscan", () => {
    const heights = Array.from({ length: 1000 }, (_, index) => (index % 2 === 0 ? 44 : 120));
    const offsets = prefixOffsets(heights);

    const range = variableWindowRange({
      scrollTop: 10_000,
      viewportHeight: 600,
      offsets,
      overscan: 2,
    });

    // Everything on screen is mounted…
    expect(offsets[range.start]!).toBeLessThanOrEqual(10_000);
    expect(offsets[range.end]!).toBeGreaterThanOrEqual(10_600);
    // …and almost nothing else is.
    expect(range.end - range.start).toBeLessThan(20);
  });

  test("the spacers and the mounted rows add up to the whole list", () => {
    const heights = Array.from({ length: 500 }, (_, index) => 30 + (index % 7) * 10);
    const offsets = prefixOffsets(heights);
    const total = heights.reduce((sum, height) => sum + height, 0);

    const range = variableWindowRange({
      scrollTop: 4_000,
      viewportHeight: 500,
      offsets,
      overscan: 3,
    });

    const mounted = heights.slice(range.start, range.end).reduce((sum, height) => sum + height, 0);

    expect(range.totalHeight).toBe(total);
    expect(range.paddingTop + mounted + range.paddingBottom).toBe(total);
  });

  test("an empty list mounts nothing", () => {
    expect(
      variableWindowRange({ scrollTop: 0, viewportHeight: 500, offsets: [0], overscan: 4 }),
    ).toEqual({ start: 0, end: 0, paddingTop: 0, paddingBottom: 0, totalHeight: 0 });
  });

  test("scrolling to a row that is already visible moves nothing", () => {
    const offsets = prefixOffsets([100, 100, 100, 100]);

    expect(variableScrollOffsetFor(1, 0, 400, offsets)).toBeNull();
    expect(variableScrollOffsetFor(0, 150, 400, offsets)).toBe(0);
    expect(variableScrollOffsetFor(3, 0, 250, offsets)).toBe(150);
    expect(variableScrollOffsetFor(9, 0, 250, offsets)).toBeNull();
  });
});

describe("numbering the steps in a cell", () => {
  const PLAIN: StepNumbering = { ...DEFAULT_STEP_NUMBERING, enabled: true };
  const B: StepNumbering = { ...PLAIN, prefix: "B" };
  const T: StepNumbering = { ...PLAIN, prefix: "T" };

  /**
   * The editor's insertion, modelled exactly as the textarea performs it:
   * replace the selection, leave the caret after what was inserted, and read
   * the next line off the *result* rather than off a stale snapshot.
   */
  function pressEnter(text: string, caret: number, config: StepNumbering) {
    const insertion = nextStepInsertion(lineAt(text, caret), config);
    const after = caret + spacesAfter(text, caret);

    return {
      text: `${text.slice(0, caret)}${insertion}${text.slice(after)}`,
      caret: caret + insertion.length,
    };
  }

  test("out of the box a step is a plain number", () => {
    expect(DEFAULT_STEP_NUMBERING.prefix).toBe("");
    expect(stepToken(PLAIN, 1)).toBe("1: ");
    expect(nextStepInsertion("1: open the page", PLAIN)).toBe("\n2: ");
  });

  test("an empty cell opens on its first step, already numbered", () => {
    expect(openingText("", undefined, PLAIN)).toBe("1: ");
    expect(openingText("", undefined, { ...B, start: 5 })).toBe("B5: ");

    // Typing into an empty cell lands after the number, not before it.
    expect(openingText("", "o", B)).toBe("B1: o");
  });

  test("an existing value is never prefixed", () => {
    expect(openingText("B1: already a step", undefined, B)).toBe("B1: already a step");
    expect(openingText("Preconditions\nB1: x", undefined, B)).toBe("Preconditions\nB1: x");
    expect(openingText("", undefined, { ...B, enabled: false })).toBe("");
  });

  test("one Enter adds one step, not a run of them", () => {
    // The bug this covers: reading the caret from a stale render inserted the
    // token again inside the line it had just opened.
    let state = { text: "C1: open the page", caret: 17 };
    const C: StepNumbering = { ...PLAIN, prefix: "C" };

    state = pressEnter(state.text, state.caret, C);
    expect(state.text).toBe("C1: open the page\nC2: ");

    state = pressEnter(state.text, state.caret, C);
    expect(state.text).toBe("C1: open the page\nC2: \nC3: ");

    // Three presses, three steps — never more.
    state = pressEnter(state.text, state.caret, C);
    expect(state.text.match(/C\d+:/g)).toEqual(["C1:", "C2:", "C3:", "C4:"]);
  });

  test("Enter part-way through a line opens the next step there, once", () => {
    const state = pressEnter("B1: open the page", 8, B);

    expect(state.text).toBe("B1: open\nB2: the page");
    expect(state.text.match(/B\d+:/g)).toEqual(["B1:", "B2:"]);
  });

  test("a step line parses into its parts", () => {
    expect(parseStepLine("B1: Open browser")).toMatchObject({
      prefix: "B",
      number: 1,
      body: "Open browser",
    });
    expect(parseStepLine("Step 12. do the thing")).toMatchObject({ number: 12 });
    expect(parseStepLine("just some prose")).toBeNull();
  });

  test("Enter opens the next step", () => {
    expect(nextStepInsertion("B1: Open browser", B)).toBe("\nB2: ");
    expect(nextStepInsertion("B2: Enter username", B)).toBe("\nB3: ");
  });

  test("the number is a number — B9 is followed by B10", () => {
    expect(nextStepInsertion("B9:", B)).toBe("\nB10: ");
    expect(nextStepInsertion("B99: last", B)).toBe("\nB100: ");
  });

  test("a different prefix carries through", () => {
    expect(nextStepInsertion("T1: Create payment", T)).toBe("\nT2: ");
    // The line's own prefix wins over the column's, so a cell stays consistent.
    expect(nextStepInsertion("T4: something", B)).toBe("\nT5: ");
  });

  test("Enter on a line that is not a step starts at the configured number", () => {
    expect(nextStepInsertion("Preconditions", B)).toBe("\nB1: ");
    expect(nextStepInsertion("Preconditions", { ...B, start: 0 })).toBe("\nB0: ");
  });

  test("the line under the caret is the one that decides", () => {
    const text = "B1: first\nB7: seventh";
    expect(lineAt(text, text.length)).toBe("B7: seventh");
    expect(nextStepInsertion(lineAt(text, text.length), B)).toBe("\nB8: ");
  });

  test("pasting plain lines numbers them; pasting numbered ones does not", () => {
    expect(numberPastedLines("Open browser\nLogin\nCheckout", B)).toBe(
      "B1: Open browser\nB2: Login\nB3: Checkout",
    );
    expect(numberPastedLines("B1: Open browser\nB2: Login", B)).toBeNull();
    expect(numberPastedLines("Just one line", B)).toBeNull();
  });

  test("formatting normalises numbering without touching the words", () => {
    expect(formatSteps("b1 open browser\nb2 login\nb3 checkout", B)).toBe(
      "B1: open browser\nB2: login\nB3: checkout",
    );
    expect(formatSteps("B3: third\nB9: ninth", B)).toBe("B1: third\nB2: ninth");
  });

  test("formatting refuses anything that is not already a list of steps", () => {
    const prose = "Open the browser\nThen log in";

    expect(looksLikeSteps(prose)).toBe(false);
    expect(formatSteps(prose, B)).toBe(prose);
    expect(canFormatSteps(prose, B)).toBe(false);
  });

  test("format is offered only when it would change something", () => {
    expect(canFormatSteps("B1: one\nB2: two", B)).toBe(false);
    expect(canFormatSteps("b1 one\nb2 two", B)).toBe(true);
  });

  test("a column says nothing about steps until somebody switches them on", () => {
    expect(stepNumberingOf({}).enabled).toBe(false);
    expect(stepToken(B, 4)).toBe("B4: ");
    expect(stepToken({ ...B, separator: "" }, 4)).toBe("B4");
  });
});

describe("the display mode belongs to the view", () => {
  test("changing it never touches the column", async () => {
    const board = await loadBoard();
    const store = () => useBoardStore.getState();

    const column = board.columns.find((candidate) => candidate.name === "Description")!;
    const before = store().board?.columns.find((candidate) => candidate.id === column.id);

    await store().setColumnDisplay(column.id, "full");

    const view = store().board?.views.find(
      (candidate) => candidate.id === store().activeViewId,
    );
    expect(view?.columnDisplay?.[column.id]).toBe("full");
    expect(store().board?.columns.find((candidate) => candidate.id === column.id)).toEqual(before);
  });

  test("it survives a reload, because the view is persisted", async () => {
    const board = await loadBoard();
    const store = () => useBoardStore.getState();
    const column = board.columns.find((candidate) => candidate.name === "Description")!;

    await store().setColumnDisplay(column.id, "wrap");
    const viewId = store().activeViewId;

    await store().load(ID.roadmap);

    const view = store().board?.views.find((candidate) => candidate.id === viewId);
    expect(view?.columnDisplay?.[column.id]).toBe("wrap");
  });

  test("step numbering belongs to the column, so everyone reading the board gets it", async () => {
    const board = await loadBoard();
    const store = () => useBoardStore.getState();
    const column = board.columns.find((candidate) => candidate.name === "Description")!;

    const numbering: StepNumbering = { enabled: true, prefix: "T", start: 1, separator: ":" };
    await store().updateColumnConfig(column.id, { config: { stepNumbering: numbering } });

    const server = await boardService.getBoard(ID.roadmap);
    const stored = server.board.columns.find((candidate) => candidate.id === column.id);

    expect(stored?.type === "longText" ? stored.config.stepNumbering : null).toEqual(numbering);
  });
});

describe("editing one cell does not disturb the schema", () => {
  test("a cell edit leaves every column object identical", async () => {
    const board = await loadBoard();
    const store = () => useBoardStore.getState();

    const before = store().board!.columns;
    const rowId = store().rowOrder[0]!;
    const value: CellValue = { kind: "text", value: "changed" };

    await store().editCells([{ rowId, columnId: board.primaryColumnId, value }]);

    // Reference equality: the memoised header and cells must not re-render.
    expect(store().board!.columns).toBe(before);
  });
});
