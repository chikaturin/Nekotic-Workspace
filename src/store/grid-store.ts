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

interface EditingCell {
  readonly rowId: string;
  readonly columnId: string;
  readonly initialText?: string;
  readonly focusId?: string;
}

export interface EditIntent {
  readonly initialText?: string;
  readonly focusId?: string;
}

interface GridState {
  readonly range: GridRange | null;
  readonly editing: EditingCell | null;
  readonly drawerRowId: string | null;
  readonly isDragSelecting: boolean;
  readonly collapsedByView: Readonly<Record<string, readonly string[]>>;
  readonly collapsedParentsByView: Readonly<Record<string, readonly string[]>>;
  readonly selectedRowIds: Readonly<Record<string, true>>;
  readonly lastSelectedRowId: string | null;
  readonly renamingColumnId: string | null;
  readonly detailCell: { readonly rowId: string; readonly columnId: string } | null;
  readonly fill: {
    readonly source: RangeBox;
    readonly preview: RangeBox;
  } | null;
}

interface GridActions {
  focusCell: (address: CellAddress) => void;
  moveFocus: (direction: MoveDirection, bounds: GridBounds, extend: boolean) => void;
  setRange: (range: GridRange | null) => void;
  beginDragSelect: (address: CellAddress) => void;
  dragSelectTo: (address: CellAddress) => void;
  endDragSelect: () => void;
  beginEdit: (rowId: string, columnId: string, intent?: EditIntent) => void;
  endEdit: () => void;
  openDrawer: (rowId: string) => void;
  closeDrawer: () => void;
  toggleGroup: (viewId: string, groupKey: string) => void;
  setCollapsedGroups: (viewId: string, keys: readonly string[]) => void;
  toggleParent: (viewId: string, rowId: string) => void;
  setCollapsedParents: (viewId: string, rowIds: readonly string[]) => void;

  beginColumnRename: (columnId: string) => void;
  endColumnRename: () => void;

  openDetail: (rowId: string, columnId: string) => void;
  closeDetail: () => void;

  beginFill: (source: RangeBox) => void;
  setFillPreview: (preview: RangeBox) => void;
  endFill: () => void;

  toggleRowSelection: (rowId: string) => void;
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
  collapsedParentsByView: {},
  selectedRowIds: {},
  lastSelectedRowId: null,
  renamingColumnId: null,
  detailCell: null,
  fill: null,
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

  beginEdit: (rowId, columnId, intent) => set({ editing: { rowId, columnId, ...intent } }),
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

  toggleParent: (viewId, rowId) =>
    set((state) => {
      const current = state.collapsedParentsByView[viewId] ?? [];
      const next = current.includes(rowId)
        ? current.filter((id) => id !== rowId)
        : [...current, rowId];

      return { collapsedParentsByView: { ...state.collapsedParentsByView, [viewId]: next } };
    }),

  setCollapsedParents: (viewId, rowIds) =>
    set((state) => ({
      collapsedParentsByView: { ...state.collapsedParentsByView, [viewId]: rowIds },
    })),

  beginFill: (source) => set({ fill: { source, preview: source } }),

  setFillPreview: (preview) =>
    set((state) => (state.fill ? { fill: { ...state.fill, preview } } : state)),

  endFill: () => set({ fill: null }),

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

  beginColumnRename: (columnId) => set({ renamingColumnId: columnId, editing: null }),
  endColumnRename: () => set({ renamingColumnId: null }),

  openDetail: (rowId, columnId) => set({ detailCell: { rowId, columnId }, editing: null }),
  closeDetail: () => set({ detailCell: null }),

  reset: () => set(INITIAL),
}));

export function selectFocus(state: GridStore): CellAddress | null {
  return state.range?.focus ?? null;
}

export function selectBox(state: GridStore): RangeBox | null {
  return state.range ? rangeBox(state.range) : null;
}

export function selectIsFocused(rowIndex: number, columnIndex: number) {
  return (state: GridStore): boolean => {
    const focus = state.range?.focus;
    return focus?.rowIndex === rowIndex && focus.columnIndex === columnIndex;
  };
}

export function selectIsSelected(rowIndex: number, columnIndex: number) {
  return (state: GridStore): boolean => {
    if (!state.range) return false;
    return isInBox(rangeBox(state.range), rowIndex, columnIndex);
  };
}

export function selectIsFillOrigin(rowIndex: number, columnIndex: number) {
  return (state: GridStore): boolean => {
    if (!state.range || state.editing) return false;

    const box = rangeBox(state.range);

    return rowIndex === box.bottom && columnIndex === box.right;
  };
}

export function selectIsFillTarget(rowIndex: number, columnIndex: number) {
  return (state: GridStore): boolean => {
    if (!state.fill) return false;

    const { source, preview } = state.fill;

    return (
      isInBox(preview, rowIndex, columnIndex) &&
      !isInBox(source, rowIndex, columnIndex)
    );
  };
}

const NO_COLLAPSED: readonly string[] = [];

export function selectCollapsedGroups(viewId: string | null) {
  return (state: GridStore): readonly string[] =>
    (viewId ? state.collapsedByView[viewId] : undefined) ?? NO_COLLAPSED;
}

export function selectCollapsedParents(viewId: string | null) {
  return (state: GridStore): readonly string[] =>
    (viewId ? state.collapsedParentsByView[viewId] : undefined) ?? NO_COLLAPSED;
}

export function selectIsEditing(rowId: string, columnId: string) {
  return (state: GridStore): boolean =>
    state.editing?.rowId === rowId && state.editing.columnId === columnId;
}

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

export function selectIsRenaming(columnId: string) {
  return (state: GridStore): boolean => state.renamingColumnId === columnId;
}
