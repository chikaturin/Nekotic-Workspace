import type { DragEvent } from "react";
import { describe, expect, test } from "vitest";
import { DND_NODE_MIME } from "@/config/app";
import {
  hasExternalFiles,
  hasInternalNode,
  readDragPayload,
  readDroppedFiles,
  setDragPayload,
  type DragPayload,
} from "@/lib/dnd";
import { useDndStore } from "@/store/dnd-store";

/** Minimal DataTransfer stand-in — jsdom is not needed for these pure helpers. */
function makeDragEvent(initial: Record<string, string> = {}, files: File[] = []): DragEvent {
  const store = new Map(Object.entries(initial));

  const dataTransfer = {
    effectAllowed: "none",
    dropEffect: "none",
    files,
    get types() {
      return [...store.keys(), ...(files.length > 0 ? ["Files"] : [])];
    },
    setData: (format: string, value: string) => store.set(format, value),
    getData: (format: string) => store.get(format) ?? "",
  };

  return { dataTransfer } as unknown as DragEvent;
}

const payload: DragPayload = { nodeId: "n1", type: "file", name: "spec.pdf" };

describe("drag payload", () => {
  test("round-trips a node through the dataTransfer", () => {
    const event = makeDragEvent();

    setDragPayload(event, payload);

    expect(readDragPayload(event)).toEqual(payload);
    expect(event.dataTransfer.effectAllowed).toBe("move");
    expect(event.dataTransfer.getData("text/plain")).toBe("spec.pdf");
  });

  test("returns null when no internal payload is present", () => {
    expect(readDragPayload(makeDragEvent())).toBeNull();
  });

  test("returns null for malformed JSON", () => {
    expect(readDragPayload(makeDragEvent({ [DND_NODE_MIME]: "{oops" }))).toBeNull();
  });

  test("returns null when the payload shape is wrong", () => {
    expect(readDragPayload(makeDragEvent({ [DND_NODE_MIME]: '{"nodeId":7}' }))).toBeNull();
    expect(readDragPayload(makeDragEvent({ [DND_NODE_MIME]: "null" }))).toBeNull();
  });
});

describe("drag classification", () => {
  test("detects an internal node drag", () => {
    expect(hasInternalNode(makeDragEvent({ [DND_NODE_MIME]: "{}" }))).toBe(true);
    expect(hasInternalNode(makeDragEvent())).toBe(false);
  });

  test("detects an OS file drag", () => {
    const withFiles = makeDragEvent({}, [new File(["a"], "a.txt")]);

    expect(hasExternalFiles(withFiles)).toBe(true);
    expect(hasExternalFiles(makeDragEvent())).toBe(false);
  });

  test("normalises dropped files to an array", () => {
    const files = [new File(["a"], "a.txt"), new File(["b"], "b.txt")];

    expect(readDroppedFiles(makeDragEvent({}, files))).toHaveLength(2);
    expect(readDroppedFiles(makeDragEvent())).toHaveLength(0);
  });
});

describe("dnd store", () => {
  test("tracks the dragging node until the gesture ends", () => {
    useDndStore.getState().startDrag("n1");
    expect(useDndStore.getState().draggingNodeId).toBe("n1");

    useDndStore.getState().endDrag();
    expect(useDndStore.getState().draggingNodeId).toBeNull();
  });

  test("clears the file-drag flag when the drag ends", () => {
    useDndStore.getState().setFileDrag(true);
    expect(useDndStore.getState().isFileDrag).toBe(true);

    useDndStore.getState().endDrag();
    expect(useDndStore.getState().isFileDrag).toBe(false);
  });
});
