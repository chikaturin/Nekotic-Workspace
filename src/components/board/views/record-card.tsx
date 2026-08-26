"use client";

import { memo } from "react";
import { CellRenderer } from "@/components/board/cells/cell-renderer";
import type { CellContext } from "@/lib/cell-values";
import { cellOf, isCellEmpty } from "@/lib/cell-values";
import { selectRow, useBoardStore } from "@/store/board-store";
import { useGridStore } from "@/store/grid-store";
import { cn } from "@/lib/utils";
import type { BoardColumn } from "@/types";

interface RecordCardProps {
  readonly rowId: string;
  readonly primaryColumnId: string;
  /** Fields shown under the title — the view's own visible columns. */
  readonly fields: readonly BoardColumn[];
  readonly context: CellContext;
  readonly canDrag: boolean;
  readonly density?: "card" | "compact";
  readonly onDragStart?: (rowId: string) => void;
  readonly onDragEnd?: () => void;
}

/**
 * One record, rendered the same way in Kanban, Calendar and Timeline.
 *
 * It subscribes to its own record and reuses the table's cell renderers, so a
 * value edited anywhere is the value every view shows — there is no card model.
 */
export const RecordCard = memo(function RecordCard({
  rowId,
  primaryColumnId,
  fields,
  context,
  canDrag,
  density = "card",
  onDragStart,
  onDragEnd,
}: RecordCardProps) {
  const row = useBoardStore(selectRow(rowId));
  const isOpen = useGridStore((state) => state.drawerRowId === rowId);

  if (!row) return null;

  const title = row.cells[primaryColumnId];
  const label = title && title.kind === "text" ? title.value : "";
  const visible = fields.filter((column) => !isCellEmpty(cellOf(row, column))).slice(0, 3);

  return (
    <article
      draggable={canDrag}
      onDragStart={(event) => {
        event.dataTransfer.setData("text/plain", rowId);
        event.dataTransfer.effectAllowed = "move";
        onDragStart?.(rowId);
      }}
      onDragEnd={onDragEnd}
      onClick={() => useGridStore.getState().openDrawer(rowId)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          useGridStore.getState().openDrawer(rowId);
        }
      }}
      role="button"
      tabIndex={0}
      aria-label={`${row.displayId} ${label}`}
      className={cn(
        "group/card w-full cursor-pointer rounded-lg border bg-surface text-left transition-colors",
        "hover:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        isOpen ? "border-accent ring-1 ring-accent" : "border-border",
        canDrag && "active:cursor-grabbing",
        density === "card" ? "p-2.5" : "px-1.5 py-1",
        row.isPending && "opacity-60",
      )}
    >
      <div className="flex items-baseline gap-1.5">
        <span className="metric shrink-0 text-[10px] text-faint-foreground">{row.displayId}</span>
        <span
          className={cn(
            "min-w-0 flex-1 text-foreground",
            density === "card" ? "line-clamp-2 text-[13px]" : "truncate text-[11px]",
          )}
        >
          {label || "Untitled"}
        </span>
      </div>

      {density === "card" && visible.length > 0 && (
        <div className="mt-1.5 flex flex-wrap items-center gap-1">
          {visible.map((column) => (
            <div key={column.id} className="max-w-full [&_>div]:px-0">
              <CellRenderer value={cellOf(row, column)} column={column} context={context} />
            </div>
          ))}
        </div>
      )}
    </article>
  );
});
