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
  /**
   * Records ticked for a bulk action (SY-BLK-34). A map, not an array, so a
   * row's checkbox subscribes to one boolean instead of the whole selection.
   */
  readonly selectedRowIds: Readonly<Record<string, true>>;
  /** Anchor for a shift-click range. */
  readonly lastSelectedRowId: string | null;
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

  toggleRowSelection: (rowId: string) => void;
  /** Shift-click: tick everything between the anchor and `rowId` in view order. */
  extendRowSelection: (orderedRowIds: readonly string[], rowId: string) => void;
  setRowSelection: (rowIds: readonly string[]) => void;
  clearRowSelection: () => void;

  reset: () => void;
}

export type GridStore = GridState & GridActions;

const INITIAL: GridState = {
  range: null,
  editing: null,
  drawerRowId: null,
  isDragSelecting: false,
  collapsedByView: {},
  selectedRowIds: {},
  lastSelectedRowId: null,
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

  toggleRowSelection: (rowId) =>
    set((state) => {
      const next = { ...state.selectedRowIds };
      if (next[rowId]) delete next[rowId];
      else next[rowId] = true;

      return { selectedRowIds: next, lastSelectedRowId: rowId };
    }),

  extendRowSelection: (orderedRowIds, rowId) =>
    set((state) => {
      const anchor = state.lastSelectedRowId;
      const from = anchor ? orderedRowIds.indexOf(anchor) : -1;
      const to = orderedRowIds.indexOf(rowId);

      // No anchor (or it scrolled out of the current filter) — plain toggle.
      if (from < 0 || to < 0) {
        return { selectedRowIds: { ...state.selectedRowIds, [rowId]: true }, lastSelectedRowId: rowId };
      }

      const next = { ...state.selectedRowIds };
      for (const id of orderedRowIds.slice(Math.min(from, to), Math.max(from, to) + 1)) {
        next[id] = true;
      }

      return { selectedRowIds: next, lastSelectedRowId: rowId };
    }),

  setRowSelection: (rowIds) =>
    set({
      selectedRowIds: Object.fromEntries(rowIds.map((id) => [id, true])),
      lastSelectedRowId: rowIds.at(-1) ?? null,
    }),

  clearRowSelection: () => set({ selectedRowIds: {}, lastSelectedRowId: null }),

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

/**
 * Bulk selection, read as booleans and counts only.
 *
 * zustand v5 subscribes through `useSyncExternalStore`, so a selector that
 * allocates on every read re-renders forever. The stored map is handed out by
 * reference and turned into a list inside a `useMemo`, never here.
 */
export function selectIsRowSelected(rowId: string) {
  return (state: GridStore): boolean => state.selectedRowIds[rowId] === true;
}

export const selectSelectedRowIds = (state: GridStore): Readonly<Record<string, true>> =>
  state.selectedRowIds;

export const selectSelectionCount = (state: GridStore): number =>
  Object.keys(state.selectedRowIds).length;

export function clampToBounds(address: CellAddress, bounds: GridBounds): CellAddress {
  return clampAddress(address, bounds);
}
