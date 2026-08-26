"use client";

import { Plus } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { GridHeader } from "@/components/board/table/grid-header";
import { GridRow } from "@/components/board/table/grid-row";
import { GroupHeader } from "@/components/board/table/group-header";
import { GUTTER_WIDTH, widthVar, type GridShared } from "@/components/board/table/grid-shared";
import { ConvertColumnDialog } from "@/components/board/table/convert-column-dialog";
import { useGridClipboard } from "@/hooks/use-grid-clipboard";
import { useGridKeyboard } from "@/hooks/use-grid-keyboard";
import { useVirtualRows } from "@/hooks/use-virtual-rows";
import type { BoardViewModel } from "@/hooks/use-board-view";
import { flattenGroups, flattenUngrouped } from "@/lib/board-grouping";
import { ROW_HEIGHTS } from "@/lib/grid-geometry";
import { useBoardStore } from "@/store/board-store";
import { selectCollapsedGroups, useGridStore } from "@/store/grid-store";
import type { BoardColumn, CellValue, ColumnType } from "@/types";

interface TableGridProps {
  readonly model: BoardViewModel;
  /** Folder that attachment uploads land in — the board's own folder. */
  readonly folderId: string | null;
  /** Rows a board-level validation has flagged. */
  readonly warnedRowIds?: ReadonlySet<string>;
}

const NO_WARNINGS: ReadonlySet<string> = new Set();

/**
 * The table view.
 *
 * Rows are virtualised (only the visible window is mounted), widths live in CSS
 * variables (a resize drag mutates the DOM, not React state) and every cell
 * subscribes to its own record, so editing one cell touches one row.
 */
export function TableGrid({ model, folderId, warnedRowIds = NO_WARNINGS }: TableGridProps) {
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

  const collapsed = useGridStore(selectCollapsedGroups(view?.id ?? null));
  const toggleGroup = useGridStore((state) => state.toggleGroup);

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
      onCreateOption,
      onCommitCell,
    ],
  );

  const slice = useMemo(
    () => ({ rowIds, columns: columnsShown, rowsById, context }),
    [rowIds, columnsShown, rowsById, context],
  );

  const { onCopy, onCut, onPaste, clearSelection } = useGridClipboard(slice);

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
  });

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
    <>
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
            onConvert={(column, type) => setConversion({ column, type })}
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

          <button
            type="button"
            onClick={() => void addRow()}
            style={{ height: rowHeight, paddingLeft: GUTTER_WIDTH }}
            className="sticky left-0 flex w-full items-center gap-1.5 border-b border-hairline px-2 text-[12px] text-faint-foreground hover:bg-hover hover:text-foreground"
          >
            <Plus className="size-3.5" />
            New record
          </button>
        </div>
      </div>

      <ConvertColumnDialog
        column={conversion?.column ?? null}
        targetType={conversion?.type ?? null}
        rows={conversionRows}
        context={context}
        onClose={() => setConversion(null)}
      />
    </>
  );
}
