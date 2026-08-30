"use client";

import { Plus } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { BulkActionBar } from "@/components/board/bulk/bulk-action-bar";
import { useBoardPeople } from "@/hooks/use-board-people";
import { GridHeader, type SelectionState } from "@/components/board/table/grid-header";
import { GridRow } from "@/components/board/table/grid-row";
import { GroupHeader } from "@/components/board/table/group-header";
import { GUTTER_WIDTH, widthVar, type GridShared } from "@/components/board/table/grid-shared";
import { ConvertColumnDialog } from "@/components/board/table/convert-column-dialog";
import { CellDetailDialog } from "@/components/board/cells/cell-detail-dialog";
import { useBulkActions } from "@/hooks/use-bulk-actions";
import { useGridClipboard } from "@/hooks/use-grid-clipboard";
import { useGridFill } from "@/hooks/use-grid-fill";
import { useGridKeyboard } from "@/hooks/use-grid-keyboard";
import { useVirtualRows } from "@/hooks/use-virtual-rows";
import type { BoardViewModel } from "@/hooks/use-board-view";
import { flattenGroups, flattenUngrouped, type RowExpander } from "@/lib/board-grouping";
import { isRowArchived } from "@/lib/archive";
import { autoFitWidth, estimateLines, heightForLines, isFlexibleColumn } from "@/lib/cell-display";
import { cellOf, cellText, type CellContext } from "@/lib/cell-values";
import { GRID_SCROLLER_ATTR } from "@/lib/dom/grid-scroll";
import { layoutHierarchy } from "@/lib/board-hierarchy";
import { ROW_HEIGHTS } from "@/lib/grid-geometry";
import { useBoardStore } from "@/store/board-store";
import {
  selectCollapsedGroups,
  selectCollapsedParents,
  selectSelectedRowIds,
  useGridStore,
} from "@/store/grid-store";
import type {
  BoardColumn,
  BoardRow,
  CellDisplayMode,
  CellValue,
  ColumnType,
  PermissionResolver,
} from "@/types";

interface TableGridProps {
  readonly model: BoardViewModel;
  readonly folderId: string | null;
  readonly warnedRowIds?: ReadonlySet<string>;
  readonly can: PermissionResolver;
  readonly onExportSelection: () => void;
}

const NO_WARNINGS: ReadonlySet<string> = new Set();
const EMPTY_DISPLAY: Readonly<Record<string, CellDisplayMode>> = {};

export function TableGrid({
  model,
  folderId,
  warnedRowIds = NO_WARNINGS,
  can,
  onExportSelection,
}: TableGridProps) {
  const { board, view, columnsShown, context, groups, groupColumn, hierarchy, subtaskDisplay } =
    model;

  const rowHeight = ROW_HEIGHTS[view?.rowHeight ?? "medium"];
  const editCells = useBoardStore((state) => state.editCells);
  const setColumnDisplay = useBoardStore((state) => state.setColumnDisplay);
  const createOption = useBoardStore((state) => state.createOption);
  const addRow = useBoardStore((state) => state.addRow);
  const commitColumnWidth = useBoardStore((state) => state.commitColumnWidth);
  const people = useBoardPeople();
  const rowsById = useBoardStore((state) => state.rowsById);

  const containerRef = useRef<HTMLDivElement>(null);
  const [conversion, setConversion] = useState<{
    column: BoardColumn;
    type: ColumnType;
  } | null>(null);

  const orderedRef = useRef<readonly string[]>([]);

  const collapsed = useGridStore(selectCollapsedGroups(view?.id ?? null));
  const collapsedParents = useGridStore(selectCollapsedParents(view?.id ?? null));
  const toggleGroup = useGridStore((state) => state.toggleGroup);
  const toggleParent = useGridStore((state) => state.toggleParent);
  const selectedMap = useGridStore(selectSelectedRowIds);

  const bulk = useBulkActions(model);
  const isReadOnly = !can("row.update");

  const expand = useMemo<RowExpander>(
    () => (ids) =>
      layoutHierarchy({
        rowIds: ids,
        rowsById,
        index: hierarchy,
        display: subtaskDisplay,
        collapsed: new Set(collapsedParents),
      }),
    [rowsById, hierarchy, subtaskDisplay, collapsedParents],
  );

  const flattened = useMemo(() => {
    if (!groups) return flattenUngrouped(model.rowIds, expand);
    return flattenGroups(groups, new Set(collapsed), expand);
  }, [groups, model.rowIds, collapsed, expand]);

  const rowIds = flattened.rowIds;

  const displayModes = useMemo(() => view?.columnDisplay ?? EMPTY_DISPLAY, [view?.columnDisplay]);

  const flexible = useMemo(
    () =>
      columnsShown.filter(
        (column) => isFlexibleColumn(column) && (displayModes[column.id] ?? "compact") !== "compact",
      ),
    [columnsShown, displayModes],
  );

  const heights = useMemo(() => {
    if (flexible.length === 0) return null;

    return flattened.flat.map((entry) => {
      if (entry.kind === "group") return rowHeight;

      const row = rowsById[entry.rowId];
      if (!row) return rowHeight;

      let lines = 1;
      for (const column of flexible) {
        const mode = displayModes[column.id] ?? "compact";
        const text = cellText(cellOf(row, column), column, context);
        const needed = estimateLines(text, column.width, mode);
        if (needed > lines) lines = needed;
      }

      return heightForLines(lines, rowHeight);
    });
  }, [flexible, flattened.flat, rowsById, displayModes, context, rowHeight]);

  const { scrollRef, range, onScroll, scrollToIndex } = useVirtualRows({
    count: flattened.flat.length,
    rowHeight,
    heights,
  });

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

  const recordIndexAt = useCallback(
    (offsetY: number): number | null => {
      const flat = flattened.flat;

      if (flat.length === 0) return null;

      let flatIndex: number;

      if (heights) {
        let cursor = 0;
        flatIndex = 0;

        while (
          flatIndex < flat.length - 1 &&
          cursor + (heights[flatIndex] ?? rowHeight) <= offsetY
        ) {
          cursor += heights[flatIndex] ?? rowHeight;
          flatIndex += 1;
        }
      } else {
        flatIndex = Math.min(Math.max(Math.floor(offsetY / rowHeight), 0), flat.length - 1);
      }

      const entry = flat[flatIndex];

      if (!entry || entry.kind === "group") return null;

      const record = flattened.flatIndexByRecord.indexOf(flatIndex);

      return record === -1 ? null : record;
    },
    [flattened.flat, flattened.flatIndexByRecord, heights, rowHeight],
  );

  const columnAt = useCallback(
    (clientX: number): number | null => {
      const scroller = scrollRef.current;

      if (!scroller) return null;

      const cells = scroller.querySelectorAll<HTMLElement>('[role="gridcell"]');
      let rightmost: { index: number; right: number } | null = null;

      for (const cell of cells) {
        const raw = cell.getAttribute("aria-colindex");

        if (raw === null) continue;

        const index = Number(raw) - 1;
        const rect = cell.getBoundingClientRect();

        if (clientX >= rect.left && clientX < rect.right) return index;

        if (!rightmost || rect.right > rightmost.right) {
          rightmost = { index, right: rect.right };
        }
      }

      return rightmost && clientX >= rightmost.right ? rightmost.index : null;
    },
    [scrollRef],
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

  const { onHandlePointerDown } = useGridFill({
    slice,
    bounds,
    recordIndexAt,
    scrollRef,
    columnAt,
    isReadOnly,
  });

  const shared = useMemo<GridShared>(
    () => ({
      boardId: board?.id ?? "",
      primaryColumnId: board?.primaryColumnId ?? "",
      folderId,
      people,
      context,
      columns: columnsShown,
      bounds,
      rowHeight,
      displayModes,
      warnedRowIds,
      can,
      isReadOnly,
      onToggleRow,
      onCreateOption,
      onCommitCell,
      onFillPointerDown: isReadOnly ? null : onHandlePointerDown,
    }),
    [
      board,
      folderId,
      people,
      context,
      columnsShown,
      bounds,
      rowHeight,
      displayModes,
      warnedRowIds,
      can,
      isReadOnly,
      onToggleRow,
      onCreateOption,
      onCommitCell,
      onHandlePointerDown,
    ],
  );

  const selectionState = useMemo<SelectionState>(() => {
    if (rowIds.length === 0) return "none";

    const ticked = rowIds.filter((rowId) => selectedMap[rowId]).length;
    if (ticked === 0) return "none";
    return ticked === rowIds.length ? "all" : "some";
  }, [rowIds, selectedMap]);

  const onToggleAll = useCallback(() => {
    const grid = useGridStore.getState();
    if (selectionState === "all") grid.clearRowSelection();
    else grid.setRowSelection(orderedRef.current);
  }, [selectionState]);

  const onConvert = useCallback(
    (column: BoardColumn, type: ColumnType) => setConversion({ column, type }),
    [],
  );

  const onSetDisplayMode = useCallback(
    (columnId: string, mode: CellDisplayMode) => void setColumnDisplay(columnId, mode),
    [setColumnDisplay],
  );

  const onAutoFitWidth = useCallback(
    (columnId: string) => {
      const column = columnsShown.find((candidate) => candidate.id === columnId);
      if (!column) return;

      const texts = orderedRef.current.map((rowId) => {
        const row = rowsById[rowId];
        return row ? cellText(cellOf(row, column), column, context) : "";
      });

      void commitColumnWidth(columnId, autoFitWidth(texts, column.name));
    },
    [columnsShown, rowsById, context, commitColumnWidth],
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

  const heightAt = (index: number) => heights?.[index] ?? rowHeight;

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div
        ref={scrollRef}
        onScroll={onScroll}
        {...{ [GRID_SCROLLER_ATTR]: "" }}
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
            displayModes={displayModes}
            onSetDisplayMode={onSetDisplayMode}
            onAutoFitWidth={onAutoFitWidth}
            onToggleAll={onToggleAll}
            onConvert={onConvert}
            onResizePreview={previewResize}
            onResizeCommit={commitResize}
          />

          <div style={{ height: range.paddingTop }} aria-hidden />

          {visible.map((entry, offset) =>
            entry.kind === "group" ? (
              <GroupHeader
                key={`group_${entry.key}`}
                label={entry.label}
                groupKey={entry.key}
                {...(entry.color ? { color: entry.color } : {})}
                count={entry.count}
                isCollapsed={entry.isCollapsed}
                height={heightAt(range.start + offset)}
                groupColumnName={groupColumn?.name ?? ""}
                onToggle={() => toggleGroup(view?.id ?? "", entry.key)}
              />
            ) : (
              <GridRow
                key={entry.rowId}
                rowId={entry.rowId}
                rowIndex={entry.recordIndex}
                height={heightAt(range.start + offset)}
                depth={entry.depth}
                hasChildren={entry.hasChildren}
                childCount={entry.childCount}
                isCollapsed={entry.isCollapsed}
                onToggleChildren={() => toggleParent(view?.id ?? "", entry.rowId)}
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
              className="sticky left-0 flex w-full items-center gap-1.5 border-b border-hairline px-2 text-ui text-faint-foreground hover:bg-hover hover:text-foreground"
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

      <GridDetailReader
        rowsById={rowsById}
        columns={columnsShown}
        context={context}
        isReadOnly={isReadOnly}
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

interface GridDetailReaderProps {
  readonly rowsById: Readonly<Record<string, BoardRow>>;
  readonly columns: readonly BoardColumn[];
  readonly context: CellContext;
  readonly isReadOnly: boolean;
}

function GridDetailReader({ rowsById, columns, context, isReadOnly }: GridDetailReaderProps) {
  const detailCell = useGridStore((state) => state.detailCell);
  const closeDetail = useGridStore((state) => state.closeDetail);

  const row = detailCell ? rowsById[detailCell.rowId] : undefined;
  const column = detailCell
    ? columns.find((candidate) => candidate.id === detailCell.columnId)
    : undefined;

  const isOrphaned = detailCell !== null && (!row || !column);

  useEffect(() => {
    if (isOrphaned) closeDetail();
  }, [isOrphaned, closeDetail]);

  const canEdit = Boolean(row) && !isReadOnly && !isRowArchived(row!);

  return (
    <CellDetailDialog
      column={column ?? null}
      value={row && column ? cellOf(row, column) : null}
      context={context}
      recordLabel={row?.displayId ?? ""}
      onClose={closeDetail}
      onEdit={
        canEdit && detailCell
          ? () => {
              closeDetail();
              useGridStore.getState().beginEdit(detailCell.rowId, detailCell.columnId);
            }
          : undefined
      }
    />
  );
}
