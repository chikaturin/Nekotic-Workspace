"use client";

import { create } from "zustand";
import {
  clampAddress,
  isInBox,
  moveAddress,
  rangeBox,
  singleRange,
  type CellAddress,
  type GridBounds,
  type GridRange,
  type MoveDirection,
  type RangeBox,
} from "@/lib/grid-selection";

/**
 * Grid interaction state, kept apart from the records.
 *
 * Cells subscribe to *booleans* out of this store ("am I active?", "am I in the
 * selection?"), so moving the cursor re-renders the two cells involved instead
 * of the whole grid.
 */

interface EditingCell {
  readonly rowId: string;
  readonly columnId: string;
  /** Text typed to open the editor, so the first keystroke is not lost. */
  readonly initialText?: string;
}

interface GridState {
  readonly range: GridRange | null;
  readonly editing: EditingCell | null;
  readonly drawerRowId: string | null;
  readonly isDragSelecting: boolean;
  /** Collapsed group keys, kept per view so switching views restores them. */
  readonly collapsedByView: Readonly<Record<string, readonly string[]>>;
}

interface GridActions {
  focusCell: (address: CellAddress) => void;
  moveFocus: (direction: MoveDirection, bounds: GridBounds, extend: boolean) => void;
  setRange: (range: GridRange | null) => void;
  beginDragSelect: (address: CellAddress) => void;
  dragSelectTo: (address: CellAddress) => void;
  endDragSelect: () => void;
  beginEdit: (rowId: string, columnId: string, initialText?: string) => void;
  endEdit: () => void;
  openDrawer: (rowId: string) => void;
  closeDrawer: () => void;
  toggleGroup: (viewId: string, groupKey: string) => void;
  setCollapsedGroups: (viewId: string, keys: readonly string[]) => void;
  reset: () => void;
}

export type GridStore = GridState & GridActions;

const INITIAL: GridState = {
  range: null,
  editing: null,
  drawerRowId: null,
  isDragSelecting: false,
  collapsedByView: {},
};

export const useGridStore = create<GridStore>()((set, get) => ({
  ...INITIAL,

  focusCell: (address) => set({ range: singleRange(address), editing: null }),

  moveFocus: (direction, bounds, extend) => {
    const current = get().range;
    const from = current?.focus ?? { rowIndex: 0, columnIndex: 0 };
    const next = moveAddress(from, direction, bounds);

    set({
      range: extend && current ? { anchor: current.anchor, focus: next } : singleRange(next),
      editing: null,
    });
  },

  setRange: (range) => set({ range }),

  beginDragSelect: (address) =>
    set({ range: singleRange(address), isDragSelecting: true, editing: null }),

  dragSelectTo: (address) => {
    const current = get().range;
    if (!current || !get().isDragSelecting) return;
    set({ range: { anchor: current.anchor, focus: address } });
  },

  endDragSelect: () => set({ isDragSelecting: false }),

  beginEdit: (rowId, columnId, initialText) => set({ editing: { rowId, columnId, initialText } }),
  endEdit: () => set({ editing: null }),

  openDrawer: (rowId) => set({ drawerRowId: rowId }),
  closeDrawer: () => set({ drawerRowId: null }),

  toggleGroup: (viewId, groupKey) =>
    set((state) => {
      const current = state.collapsedByView[viewId] ?? [];
      const next = current.includes(groupKey)
        ? current.filter((key) => key !== groupKey)
        : [...current, groupKey];

      return { collapsedByView: { ...state.collapsedByView, [viewId]: next } };
    }),

  setCollapsedGroups: (viewId, keys) =>
    set((state) => ({ collapsedByView: { ...state.collapsedByView, [viewId]: keys } })),

  reset: () => set(INITIAL),
}));

/* -------------------------------------------------------------- selectors */

export function selectFocus(state: GridStore): CellAddress | null {
  return state.range?.focus ?? null;
}

export function selectBox(state: GridStore): RangeBox | null {
  return state.range ? rangeBox(state.range) : null;
}

/** True when this coordinate holds the cursor. */
export function selectIsFocused(rowIndex: number, columnIndex: number) {
  return (state: GridStore): boolean => {
    const focus = state.range?.focus;
    return focus?.rowIndex === rowIndex && focus.columnIndex === columnIndex;
  };
}

/** True when this coordinate falls inside a multi-cell selection. */
export function selectIsSelected(rowIndex: number, columnIndex: number) {
  return (state: GridStore): boolean => {
    if (!state.range) return false;
    return isInBox(rangeBox(state.range), rowIndex, columnIndex);
  };
}

/** Collapsed keys for one view — a stable empty array when there are none. */
const NO_COLLAPSED: readonly string[] = [];

export function selectCollapsedGroups(viewId: string | null) {
  return (state: GridStore): readonly string[] =>
    (viewId ? state.collapsedByView[viewId] : undefined) ?? NO_COLLAPSED;
}

export function selectIsEditing(rowId: string, columnId: string) {
  return (state: GridStore): boolean =>
    state.editing?.rowId === rowId && state.editing.columnId === columnId;
}

export function clampToBounds(address: CellAddress, bounds: GridBounds): CellAddress {
  return clampAddress(address, bounds);
}
