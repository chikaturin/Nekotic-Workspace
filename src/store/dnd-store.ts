"use client";

import { create } from "zustand";

interface DndState {
  /** Node currently being dragged inside the app, if any. */
  readonly draggingNodeId: string | null;
  /** True while an OS file drag is hovering the window. */
  readonly isFileDrag: boolean;
  startDrag: (nodeId: string) => void;
  endDrag: () => void;
  setFileDrag: (isFileDrag: boolean) => void;
}

/**
 * Drag state lives apart from the workspace store: it changes on every drag
 * gesture and no data component should re-render because of it.
 */
export const useDndStore = create<DndState>()((set) => ({
  draggingNodeId: null,
  isFileDrag: false,
  startDrag: (nodeId) => set({ draggingNodeId: nodeId }),
  endDrag: () => set({ draggingNodeId: null, isFileDrag: false }),
  setFileDrag: (isFileDrag) => set({ isFileDrag }),
}));
