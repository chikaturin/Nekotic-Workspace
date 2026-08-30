"use client";

import { create } from "zustand";

interface DndState {
  readonly draggingNodeId: string | null;
  readonly isFileDrag: boolean;
  startDrag: (nodeId: string) => void;
  endDrag: () => void;
  setFileDrag: (isFileDrag: boolean) => void;
}

export const useDndStore = create<DndState>()((set) => ({
  draggingNodeId: null,
  isFileDrag: false,
  startDrag: (nodeId) => set({ draggingNodeId: nodeId }),
  endDrag: () => set({ draggingNodeId: null, isFileDrag: false }),
  setFileDrag: (isFileDrag) => set({ isFileDrag }),
}));
