"use client";

import { Archive, ChevronRight, Maximize2 } from "lucide-react";
import { memo, type MouseEvent } from "react";
import { GridCell } from "@/components/board/table/grid-cell";
import { GUTTER_WIDTH, type GridShared } from "@/components/board/table/grid-shared";
import { GRID_FROZEN_ATTR } from "@/lib/dom/grid-scroll";
import { RowActionsMenu } from "@/components/board/table/row-actions-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { isRowArchived } from "@/lib/archive";
import { isSubtask } from "@/lib/board-hierarchy";
import { selectRow, useBoardStore } from "@/store/board-store";
import { selectIsRowSelected, useGridStore } from "@/store/grid-store";
import { cn } from "@/lib/utils";

interface GridRowProps {
  readonly rowId: string;
  readonly rowIndex: number;
  readonly shared: GridShared;
  /** Hierarchy depth — 0 for a top-level record, 1 for a subtask, and so on. */
  readonly depth?: number;
  readonly hasChildren?: boolean;
  readonly childCount?: number;
  readonly isCollapsed?: boolean;
  readonly onToggleChildren?: () => void;
}

/** Indent per level. Applied to the primary cell only, so widths stay honest. */
const INDENT_PER_LEVEL = 18;

/**
 * One record.
 *
 * The row subscribes to its own record and to two booleans — "is my drawer
 * open", "am I ticked" — so editing a cell in row 12 re-renders row 12 and
 * leaves the other 4.999 untouched. That is the whole reason the store is
 * normalised and the bulk selection is a map rather than an array.
 */
export const GridRow = memo(function GridRow({
  rowId,
  rowIndex,
  shared,
  depth = 0,
  hasChildren = false,
  childCount = 0,
  isCollapsed = false,
  onToggleChildren,
}: GridRowProps) {
  const row = useBoardStore(selectRow(rowId));
  const isOpen = useGridStore((state) => state.drawerRowId === rowId);
  const isSelected = useGridStore(selectIsRowSelected(rowId));

  if (!row) return null;

  const isArchived = isRowArchived(row);
  const isWarned = shared.warnedRowIds.has(rowId);
  const isChild = isSubtask(row);

  function handleTick(event: MouseEvent<HTMLInputElement>) {
    // Shift-click ticks the run between the last click and this one, in the
    // order the view is showing — not the order the board stores.
    if (event.shiftKey) event.preventDefault();
    shared.onToggleRow(rowId, event.shiftKey);
  }

  return (
    <div
      role="row"
      aria-rowindex={rowIndex + 2}
      aria-selected={isSelected}
      style={{ height: shared.rowHeight }}
      className={cn(
        "group/row flex w-max",
        isOpen && "bg-accent-soft",
        isSelected && "bg-selection",
        isWarned && "bg-warning/8",
      )}
    >
      <div
        style={{ width: GUTTER_WIDTH }}
        {...{ [GRID_FROZEN_ATTR]: "" }}
        className={cn(
          "sticky left-0 z-sticky flex shrink-0 items-center gap-1 border-b border-r border-hairline px-1.5",
          isWarned ? "border-l-2 border-l-warning bg-warning/10" : "bg-surface",
          isSelected && "bg-selection",
        )}
      >
        <Checkbox
          checked={isSelected}
          aria-label={`Select ${row.displayId}`}
          onClick={handleTick}
          onChange={() => undefined}
          className={cn(
            "transition-opacity",
            !isSelected && "opacity-0 group-hover/row:opacity-100 has-[:focus-visible]:opacity-100",
          )}
        />

        <span
          className={cn(
            "metric w-5 shrink-0 text-right text-micro text-faint-foreground",
            "group-hover/row:hidden",
          )}
        >
          {rowIndex + 1}
        </span>

        <button
          type="button"
          aria-label={`Open ${row.displayId}`}
          onClick={() => useGridStore.getState().openDrawer(rowId)}
          className="hidden size-5 shrink-0 items-center justify-center rounded text-faint-foreground hover:bg-hover hover:text-foreground group-hover/row:flex"
        >
          <Maximize2 className="size-3" />
        </button>

        {isArchived ? (
          <span
            title="Archived — read-only until restored"
            className="flex size-5 shrink-0 items-center justify-center text-faint-foreground"
          >
            <Archive className="size-3" />
          </span>
        ) : (
          <RowActionsMenu
            rowId={rowId}
            displayId={row.displayId}
            can={shared.can}
            isSubtask={isChild}
          />
        )}
      </div>

      <div className={cn("flex", isArchived && "is-frozen")}>
        {shared.columns.map((column, columnIndex) => (
          <GridCell
            key={column.id}
            row={row}
            column={column}
            rowIndex={rowIndex}
            columnIndex={columnIndex}
            shared={shared}
            isReadOnly={shared.isReadOnly || isArchived}
            {...(column.isPrimary
              ? {
                  indent: depth * INDENT_PER_LEVEL,
                  ...(hasChildren && onToggleChildren
                    ? {
                        disclosure: (
                          <button
                            type="button"
                            aria-expanded={!isCollapsed}
                            aria-label={`${isCollapsed ? "Expand" : "Collapse"} ${childCount} subtask${childCount === 1 ? "" : "s"} of ${row.displayId}`}
                            onClick={(event) => {
                              event.stopPropagation();
                              onToggleChildren();
                            }}
                            onMouseDown={(event) => event.stopPropagation()}
                            className="flex size-4 shrink-0 items-center justify-center rounded text-faint-foreground hover:bg-hover hover:text-foreground"
                          >
                            <ChevronRight
                              className={cn(
                                "size-3 transition-transform",
                                !isCollapsed && "rotate-90",
                              )}
                            />
                          </button>
                        ),
                      }
                    : {}),
                }
              : {})}
          />
        ))}
      </div>
    </div>
  );
});
