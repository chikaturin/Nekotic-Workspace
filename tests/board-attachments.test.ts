import { beforeEach, describe, expect, test } from "vitest";
import {
  allAttachmentsOf,
  attachmentColumns,
  attachmentFromAsset,
  attachmentKind,
  attachmentPreview,
  attachmentsOf,
  isImageAttachment,
  isReachable,
  NON_RENDERABLE_TYPES,
} from "@/lib/attachments";
import { resetSimulation, setSimulation } from "@/services/simulation";
import { useBoardStore } from "@/store/board-store";
import { useWorkspaceStore } from "@/store/workspace-store";
import type { BoardRow, CellAttachment, FileAsset } from "@/types";
import { buildTestTree, ID, TEST_WORKSPACE } from "./helpers";

/**
 * Attachments on records.
 *
 * The property under test: the record's attachment cell is the only storage.
 * Nothing keeps a second list, and nothing puts bytes in board state.
 */

const WORKSPACE_ID = "ws_test";

function attachment(overrides: Partial<CellAttachment> = {}): CellAttachment {
  return {
    id: "asset_1",
    name: "payment-error.png",
    mimeType: "image/png",
    sizeBytes: 2048,
    url: "blob:https://app/asset_1",
    thumbnailUrl: "blob:https://app/asset_1",
    ...overrides,
  };
}

describe("attachment classification", () => {
  test("an image needs its MIME type and its extension to agree", () => {
    expect(isImageAttachment(attachment())).toBe(true);
    expect(isImageAttachment(attachment({ name: "notes.txt", mimeType: "image/png" }))).toBe(false);
    expect(isImageAttachment(attachment({ name: "a.png", mimeType: "text/plain" }))).toBe(false);
  });

  test("uploaded markup is never treated as a renderable image", () => {
    const svg = attachment({ name: "logo.svg", mimeType: "image/svg+xml" });

    expect(NON_RENDERABLE_TYPES.has("image/svg+xml")).toBe(true);
    expect(isImageAttachment(svg)).toBe(false);
    expect(attachmentPreview(svg)).toBe("none");
    expect(attachmentPreview(attachment({ name: "x.html", mimeType: "text/html" }))).toBe("none");
  });

  test("a PDF previews as a PDF and a log as text", () => {
    expect(attachmentPreview(attachment({ name: "api-log.pdf", mimeType: "application/pdf" })))
      .toBe("pdf");
    expect(attachmentPreview(attachment({ name: "request.json", mimeType: "application/json" })))
      .toBe("text");
  });

  test("the icon follows the file, not the declared type alone", () => {
    expect(attachmentKind(attachment())).toBe("image");
    expect(attachmentKind(attachment({ name: "a.pdf", mimeType: "application/pdf" }))).toBe("pdf");
    expect(attachmentKind(attachment({ name: "a.zip", mimeType: "application/zip" }))).toBe("archive");
    expect(attachmentKind(attachment({ name: "a.request", mimeType: "" }))).toBe("other");
  });

  test("an attachment with no session URL is unreachable, so the viewer offers a download", () => {
    const gone = attachment({ url: null, thumbnailUrl: null });

    expect(isReachable(gone)).toBe(false);
    expect(isReachable(attachment())).toBe(true);
  });

  test("an asset becomes metadata, never bytes", () => {
    const asset: FileAsset = {
      id: "asset_9",
      name: "callback-response.png",
      extension: "png",
      mimeType: "image/png",
      sizeBytes: 512,
      kind: "image",
      owner: { id: "u1", name: "Chi", email: "chi@example.com", avatarUrl: "", initials: "C" },
      createdAt: "2026-08-01T00:00:00.000Z",
      updatedAt: "2026-08-01T00:00:00.000Z",
      folderId: null,
    };

    const stored = attachmentFromAsset(asset, "blob:x", "blob:x");

    expect(stored).toMatchObject({ id: "asset_9", uploadedBy: "u1", url: "blob:x" });
    expect(JSON.stringify(stored)).not.toContain("base64");
    expect(JSON.stringify(stored).length).toBeLessThan(400);
  });
});

/* ------------------------------------------------------------- one field */

describe("one field, two surfaces", () => {
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

  function firstRow(): BoardRow {
    const state = useBoardStore.getState();
    const id = state.rowOrder[0];
    const row = id ? state.rowsById[id] : undefined;
    if (!row) throw new Error("board did not load");
    return row;
  }

  test("the board declares an attachment column", () => {
    const columns = useBoardStore.getState().board?.columns ?? [];

    expect(attachmentColumns(columns).map((column) => column.id)).toContain("col_evidence");
  });

  test("a write through the cell is the write the drawer reads", async () => {
    const row = firstRow();
    const files = [attachment(), attachment({ id: "asset_2", name: "api-log.pdf", mimeType: "application/pdf" })];

    // Both surfaces call `editCells` on the same column — this is that call.
    await useBoardStore.getState().editCells([
      { rowId: row.id, columnId: "col_evidence", value: { kind: "attachment", attachments: files } },
    ]);

    const updated = useBoardStore.getState().rowsById[row.id];
    const columns = useBoardStore.getState().board?.columns ?? [];

    // The cell projection and the drawer projection are the same value.
    expect(attachmentsOf(updated, "col_evidence")).toHaveLength(2);
    expect(allAttachmentsOf(updated, columns)).toHaveLength(2);
    expect(attachmentsOf(updated, "col_evidence")).toEqual(allAttachmentsOf(updated, columns));
  });

  test("removing one leaves the rest, on the record itself", async () => {
    const row = firstRow();
    const files = [attachment(), attachment({ id: "asset_2", name: "b.png" })];

    await useBoardStore.getState().editCells([
      { rowId: row.id, columnId: "col_evidence", value: { kind: "attachment", attachments: files } },
    ]);

    const kept = attachmentsOf(useBoardStore.getState().rowsById[row.id], "col_evidence").filter(
      (file) => file.id !== "asset_1",
    );

    await useBoardStore.getState().editCells([
      { rowId: row.id, columnId: "col_evidence", value: { kind: "attachment", attachments: kept } },
    ]);

    const remaining = attachmentsOf(useBoardStore.getState().rowsById[row.id], "col_evidence");
    expect(remaining.map((file) => file.id)).toEqual(["asset_2"]);
  });

  test("attachments survive a reload from the service", async () => {
    const row = firstRow();

    await useBoardStore.getState().editCells([
      {
        rowId: row.id,
        columnId: "col_evidence",
        value: { kind: "attachment", attachments: [attachment()] },
      },
    ]);

    await useBoardStore.getState().reload();

    const reloaded = useBoardStore.getState().rowsById[row.id];
    expect(attachmentsOf(reloaded, "col_evidence").map((file) => file.name)).toEqual([
      "payment-error.png",
    ]);
  });

  test("an attachment never becomes a node in the folder tree", async () => {
    const row = firstRow();
    const before = useWorkspaceStore.getState().treeByWorkspace[WORKSPACE_ID];

    await useBoardStore.getState().editCells([
      {
        rowId: row.id,
        columnId: "col_evidence",
        value: { kind: "attachment", attachments: [attachment()] },
      },
    ]);

    expect(useWorkspaceStore.getState().treeByWorkspace[WORKSPACE_ID]).toBe(before);
  });
});
