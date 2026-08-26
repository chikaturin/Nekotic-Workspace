import { describe, expect, test } from "vitest";
import {
  blockTypeForMarkdown,
  detectMarkdownShortcut,
  findBlockCommand,
  matchBlockCommands,
  BLOCK_COMMANDS,
} from "@/lib/block-commands";
import {
  addTableColumn,
  addTableRow,
  columnCount,
  normalizeTable,
  removeTableColumn,
  removeTableRow,
  rowCount,
  setTableCell,
  toggleHeaderRow,
} from "@/lib/table";
import { autosaveReducer, hasUnsavedWork, INITIAL_SAVE_STATE, shouldSave } from "@/lib/autosave";
import type { SaveState, TableBlock } from "@/types";

const table = (): TableBlock => ({
  id: "t",
  type: "table",
  hasHeaderRow: true,
  rows: [
    ["a", "b"],
    ["c", "d"],
  ],
});

describe("block commands", () => {
  test("an empty query returns the whole catalog", () => {
    expect(matchBlockCommands("")).toHaveLength(BLOCK_COMMANDS.length);
  });

  test("label prefixes rank above keyword hits", () => {
    const results = matchBlockCommands("head");
    expect(results[0]?.type).toBe("heading1");
  });

  test("keywords find blocks whose label does not match", () => {
    expect(matchBlockCommands("todo").map((command) => command.type)).toContain("checklist");
  });

  test("an unmatched query returns nothing", () => {
    expect(matchBlockCommands("zzzz")).toHaveLength(0);
  });

  test("commands can be looked up by type", () => {
    expect(findBlockCommand("code")?.label).toBe("Code block");
    expect(findBlockCommand("paragraph")?.group).toBe("text");
  });
});

describe("markdown shortcuts", () => {
  test.each([
    ["# ", "heading1"],
    ["## ", "heading2"],
    ["### ", "heading3"],
    ["- ", "bulletList"],
    ["1. ", "numberedList"],
    ["> ", "quote"],
    ["[] ", "checklist"],
  ])("%s becomes %s", (prefix, expected) => {
    const shortcut = detectMarkdownShortcut(`${prefix}Some text`);

    expect(shortcut?.type).toBe(expected);
    expect(shortcut?.rest).toBe("Some text");
  });

  test("unknown prefixes are left alone", () => {
    expect(detectMarkdownShortcut("hello world")).toBeNull();
    expect(detectMarkdownShortcut("#no-space")).toBeNull();
    expect(blockTypeForMarkdown("@@")).toBeNull();
  });
});

describe("table operations", () => {
  test("dimensions are reported from the grid", () => {
    expect(columnCount(table())).toBe(2);
    expect(rowCount(table())).toBe(2);
  });

  test("cells update immutably", () => {
    const original = table();
    const next = setTableCell(original, 1, 0, "changed");

    expect(next.rows[1]?.[0]).toBe("changed");
    expect(original.rows[1]?.[0]).toBe("c");
  });

  test("rows and columns can be added at the end or a position", () => {
    expect(rowCount(addTableRow(table()))).toBe(3);
    expect(columnCount(addTableColumn(table()))).toBe(3);
    expect(addTableRow(table(), 0).rows[0]).toEqual(["", ""]);
  });

  test("the grid never shrinks below one row and one column", () => {
    const single: TableBlock = { id: "t", type: "table", hasHeaderRow: false, rows: [["only"]] };

    expect(removeTableRow(single, 0)).toBe(single);
    expect(removeTableColumn(single, 0)).toBe(single);
  });

  test("removing a row or column keeps the grid rectangular", () => {
    const withoutRow = removeTableRow(table(), 0);
    const withoutColumn = removeTableColumn(table(), 1);

    expect(withoutRow.rows).toHaveLength(1);
    expect(withoutColumn.rows.every((row) => row.length === 1)).toBe(true);
  });

  test("normalize pads ragged rows", () => {
    const ragged: TableBlock = {
      id: "t",
      type: "table",
      hasHeaderRow: false,
      rows: [["a", "b", "c"], ["d"]],
    };

    expect(normalizeTable(ragged).rows[1]).toEqual(["d", "", ""]);
  });

  test("the header row toggles", () => {
    expect(toggleHeaderRow(table()).hasHeaderRow).toBe(false);
  });
});

describe("autosave state machine", () => {
  const edited = autosaveReducer(INITIAL_SAVE_STATE, { type: "edit" });

  test("an edit marks the document pending", () => {
    expect(edited.hasPendingChanges).toBe(true);
    expect(edited.status).toBe("idle");
    expect(shouldSave(edited)).toBe(true);
  });

  test("starting a save clears the pending flag", () => {
    const saving = autosaveReducer(edited, { type: "save-start" });

    expect(saving.status).toBe("saving");
    expect(saving.hasPendingChanges).toBe(false);
    expect(shouldSave(saving)).toBe(false);
  });

  test("an edit during a save keeps reporting saving and re-queues", () => {
    const saving = autosaveReducer(edited, { type: "save-start" });
    const editedAgain = autosaveReducer(saving, { type: "edit" });

    expect(editedAgain.status).toBe("saving");
    expect(editedAgain.hasPendingChanges).toBe(true);
  });

  test("a successful save reports saved with a timestamp", () => {
    const saving = autosaveReducer(edited, { type: "save-start" });
    const saved = autosaveReducer(saving, {
      type: "save-success",
      savedAt: "2026-08-26T10:00:00.000Z",
    });

    expect(saved.status).toBe("saved");
    expect(saved.lastSavedAt).toBe("2026-08-26T10:00:00.000Z");
    expect(saved.error).toBeNull();
  });

  test("a save that finished with newer edits queued goes back to idle", () => {
    const saving = autosaveReducer(edited, { type: "save-start" });
    const editedDuringSave = autosaveReducer(saving, { type: "edit" });
    const saved = autosaveReducer(editedDuringSave, {
      type: "save-success",
      savedAt: "2026-08-26T10:00:00.000Z",
    });

    expect(saved.status).toBe("idle");
    expect(shouldSave(saved)).toBe(true);
  });

  test("a failure keeps the work pending so a retry has something to send", () => {
    const saving = autosaveReducer(edited, { type: "save-start" });
    const failed = autosaveReducer(saving, { type: "save-error", message: "Network down" });

    expect(failed.status).toBe("error");
    expect(failed.error).toBe("Network down");
    expect(failed.hasPendingChanges).toBe(true);
    expect(hasUnsavedWork(failed)).toBe(true);
  });

  test("reset clears everything but the last save time", () => {
    const reset = autosaveReducer(
      { status: "error", error: "x", hasPendingChanges: true, lastSavedAt: null },
      { type: "reset", savedAt: "2026-08-26T09:00:00.000Z" },
    );

    expect(reset.status).toBe("idle");
    expect(reset.error).toBeNull();
    expect(reset.lastSavedAt).toBe("2026-08-26T09:00:00.000Z");
  });

  test("a clean saved state has no unsaved work", () => {
    const clean: SaveState = {
      status: "saved",
      error: null,
      hasPendingChanges: false,
      lastSavedAt: "2026-08-26T09:00:00.000Z",
    };

    expect(hasUnsavedWork(clean)).toBe(false);
  });
});
