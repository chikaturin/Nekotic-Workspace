"use client";

import { Plus } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { BulkActionBar } from "@/components/board/bulk/bulk-action-bar";
import { GridHeader, type SelectionState } from "@/components/board/table/grid-header";
import { GridRow } from "@/components/board/table/grid-row";
import { GroupHeader } from "@/components/board/table/group-header";
import { GUTTER_WIDTH, widthVar, type GridShared } from "@/components/board/table/grid-shared";
import { ConvertColumnDialog } from "@/components/board/table/convert-column-dialog";
import { useBulkActions } from "@/hooks/use-bulk-actions";
import { useGridClipboard } from "@/hooks/use-grid-clipboard";
import { useGridKeyboard } from "@/hooks/use-grid-keyboard";
import { useVirtualRows } from "@/hooks/use-virtual-rows";
import type { BoardViewModel } from "@/hooks/use-board-view";
import { flattenGroups, flattenUngrouped } from "@/lib/board-grouping";
import { ROW_HEIGHTS } from "@/lib/grid-geometry";
import { useBoardStore } from "@/store/board-store";
import { selectCollapsedGroups, selectSelectedRowIds, useGridStore } from "@/store/grid-store";
import type { BoardColumn, CellValue, ColumnType, PermissionResolver } from "@/types";

interface TableGridProps {
  readonly model: BoardViewModel;
  /** Folder that attachment uploads land in — the board's own folder. */
  readonly folderId: string | null;
  /** Rows a board-level validation has flagged. */
  readonly warnedRowIds?: ReadonlySet<string>;
  /** Bound permission resolver for this board (SY-RBC-42). */
  readonly can: PermissionResolver;
  /** Opens the export dialog already scoped to the ticked records. */
  readonly onExportSelection: () => void;
}

const NO_WARNINGS: ReadonlySet<string> = new Set();

/**
 * The table view.
 *
 * Rows are virtualised (only the visible window is mounted), widths live in CSS
 * variables (a resize drag mutates the DOM, not React state) and every cell
 * subscribes to its own record, so editing one cell touches one row.
 */
export function TableGrid({
  model,
  folderId,
  warnedRowIds = NO_WARNINGS,
  can,
  onExportSelection,
}: TableGridProps) {
  const { board, view, columnsShown, context, groups, groupColumn } = model;

  const rowHeight = ROW_HEIGHTS[view?.rowHeight ?? "medium"];
  const editCells = useBoardStore((state) => state.editCells);
  const createOption = useBoardStore((state) => state.createOption);
  const addRow = useBoardStore((state) => state.addRow);
  const commitColumnWidth = useBoardStore((state) => state.commitColumnWidth);
  const people = useBoardStore((state) => state.people);
  const rowsById = useBoardStore((state) => state.rowsById);

  const containerRef = useRef<HTMLDivElement>(null);
  const [conversion, setConversion] = useState<{
    column: BoardColumn;
    type: ColumnType;
  } | null>(null);

  /**
   * The view's row order, for shift-click ranges. It lives in a ref because it
   * changes on every edit and `shared` must not.
   */
  const orderedRef = useRef<readonly string[]>([]);

  const collapsed = useGridStore(selectCollapsedGroups(view?.id ?? null));
  const toggleGroup = useGridStore((state) => state.toggleGroup);
  const selectedMap = useGridStore(selectSelectedRowIds);

  const bulk = useBulkActions(model);
  const isReadOnly = !can("row.update");

  /**
   * Grouped and ungrouped take the same path: one flat, uniform-height list of
   * group headers and records, which is what the window maths needs.
   */
  const flattened = useMemo(() => {
    if (!groups) return flattenUngrouped(model.rowIds);
    return flattenGroups(groups, new Set(collapsed));
  }, [groups, model.rowIds, collapsed]);

  const rowIds = flattened.rowIds;

  const { scrollRef, range, onScroll, scrollToIndex } = useVirtualRows({
    count: flattened.flat.length,
    rowHeight,
  });

  /** Keyboard moves by record; the scroller works in flat positions. */
  const scrollToRecord = useCallback(
    (recordIndex: number) => scrollToIndex(flattened.flatIndexByRecord[recordIndex] ?? recordIndex),
    [scrollToIndex, flattened.flatIndexByRecord],
  );

  const onToggleRow = useCallback((rowId: string, isRange: boolean) => {
    const grid = useGridStore.getState();
    if (isRange) grid.extendRowSelection(orderedRef.current, rowId);
    else grid.toggleRowSelection(rowId);
  }, []);

  const onCommitCell = useCallback(
    (rowId: string, columnId: string, value: CellValue) => {
      void editCells([{ rowId, columnId, value }]);
    },
    [editCells],
  );

  const onCreateOption = useCallback(
    (columnId: string, label: string) => createOption(columnId, label),
    [createOption],
  );

  const shared = useMemo<GridShared>(
    () => ({
      boardId: board?.id ?? "",
      primaryColumnId: board?.primaryColumnId ?? "",
      folderId,
      people,
      context,
      columns: columnsShown,
      rowHeight,
      warnedRowIds,
      can,
      isReadOnly,
      onToggleRow,
      onCreateOption,
      onCommitCell,
    }),
    [
      board,
      folderId,
      people,
      context,
      columnsShown,
      rowHeight,
      warnedRowIds,
      can,
      isReadOnly,
      onToggleRow,
      onCreateOption,
      onCommitCell,
    ],
  );

  /**
   * How much of what is on screen is ticked. Derived from the view's own row
   * ids, so "select all" means "all the records you can see", not every record
   * a filter is hiding.
   */
  const selectionState = useMemo<SelectionState>(() => {
    if (rowIds.length === 0) return "none";

    const ticked = rowIds.filter((rowId) => selectedMap[rowId]).length;
    if (ticked === 0) return "none";
    return ticked === rowIds.length ? "all" : "some";
  }, [rowIds, selectedMap]);

  /**
   * The header is memoised, so its callbacks have to be stable too: an inline
   * arrow here re-renders every column header on every keystroke in a cell.
   */
  /**
   * Reads the row ids through the ref rather than the controller: the query
   * returns a fresh array on every cell edit, and depending on it here would
   * re-render every column header on every keystroke.
   */
  const onToggleAll = useCallback(() => {
    const grid = useGridStore.getState();
    if (selectionState === "all") grid.clearRowSelection();
    else grid.setRowSelection(orderedRef.current);
  }, [selectionState]);

  const onConvert = useCallback(
    (column: BoardColumn, type: ColumnType) => setConversion({ column, type }),
    [],
  );

  const slice = useMemo(
    () => ({ rowIds, columns: columnsShown, rowsById, context }),
    [rowIds, columnsShown, rowsById, context],
  );

  const { onCopy, onCut, onPaste, clearSelection } = useGridClipboard(slice, isReadOnly);

  const bounds = useMemo(
    () => ({ rowCount: rowIds.length, columnCount: columnsShown.length }),
    [rowIds.length, columnsShown.length],
  );

  const onKeyDown = useGridKeyboard({
    bounds,
    rowIds,
    columns: columnsShown,
    onClearSelection: clearSelection,
    onScrollToRow: scrollToRecord,
    isReadOnly,
  });

  useEffect(() => {
    orderedRef.current = rowIds;
  }, [rowIds]);

  /** A drag selection ends wherever the pointer is released. */
  useEffect(() => {
    const stop = () => useGridStore.getState().endDragSelect();
    window.addEventListener("pointerup", stop);
    return () => window.removeEventListener("pointerup", stop);
  }, []);

  const widthVars = useMemo(() => {
    const style: Record<string, string> = {};
    for (const column of columnsShown) style[widthVar(column.id)] = `${column.width}px`;
    return style as CSSProperties;
  }, [columnsShown]);

  const previewResize = useCallback((columnId: string, width: number) => {
    containerRef.current?.style.setProperty(widthVar(columnId), `${width}px`);
  }, []);

  const commitResize = useCallback(
    (columnId: string, width: number) => void commitColumnWidth(columnId, width),
    [commitColumnWidth],
  );

  // Only materialised while the conversion dialog is open — it walks every row.
  const conversionRows = useMemo(
    () =>
      conversion
        ? model.rowIds
            .map((id) => rowsById[id])
            .filter((row): row is NonNullable<typeof row> => Boolean(row))
        : [],
    [conversion, model.rowIds, rowsById],
  );

  const visible = flattened.flat.slice(range.start, range.end);

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="min-h-0 flex-1 overflow-auto bg-canvas outline-none"
      >
        <div
          ref={containerRef}
          role="grid"
          tabIndex={0}
          aria-rowcount={rowIds.length + 1}
          aria-colcount={columnsShown.length}
          aria-label={board?.name ?? "Board"}
          onKeyDown={onKeyDown}
          onCopy={onCopy}
          onCut={onCut}
          onPaste={onPaste}
          style={widthVars}
          className="w-max min-w-full outline-none"
        >
          <GridHeader
            columns={columnsShown}
            selectionState={selectionState}
            can={can}
            // A partial selection extends to everything on screen; only a full
            // one clears, because the bar already carries its own dismiss.
            onToggleAll={onToggleAll}
            onConvert={onConvert}
            onResizePreview={previewResize}
            onResizeCommit={commitResize}
          />

          <div style={{ height: range.paddingTop }} aria-hidden />

          {visible.map((entry) =>
            entry.kind === "group" ? (
              <GroupHeader
                key={`group_${entry.key}`}
                label={entry.label}
                groupKey={entry.key}
                {...(entry.color ? { color: entry.color } : {})}
                count={entry.count}
                isCollapsed={entry.isCollapsed}
                height={rowHeight}
                groupColumnName={groupColumn?.name ?? ""}
                onToggle={() => toggleGroup(view?.id ?? "", entry.key)}
              />
            ) : (
              <GridRow
                key={entry.rowId}
                rowId={entry.rowId}
                rowIndex={entry.recordIndex}
                shared={shared}
              />
            ),
          )}

          <div style={{ height: range.paddingBottom }} aria-hidden />

          {can("row.create") && (
            <button
              type="button"
              onClick={() => void addRow()}
              style={{ height: rowHeight, paddingLeft: GUTTER_WIDTH }}
              className="sticky left-0 flex w-full items-center gap-1.5 border-b border-hairline px-2 text-[12px] text-faint-foreground hover:bg-hover hover:text-foreground"
            >
              <Plus className="size-3.5" />
              New record
            </button>
          )}
        </div>
      </div>

      <BulkActionBar
        controller={bulk}
        people={people}
        currentBoardId={board?.id ?? ""}
        can={can}
        onExport={onExportSelection}
      />

      <ConvertColumnDialog
        column={conversion?.column ?? null}
        targetType={conversion?.type ?? null}
        rows={conversionRows}
        context={context}
        onClose={() => setConversion(null)}
      />
    </div>
  );
}
