"use client";

import { ListTree } from "lucide-react";
import { memo } from "react";
import { CellRenderer } from "@/components/board/cells/cell-renderer";
import {
  childIdsOf,
  isSubtask,
  subtaskProgress,
  type HierarchyIndex,
} from "@/lib/board-hierarchy";
import type { CellContext } from "@/lib/cell-values";
import { cellOf, isCellEmpty } from "@/lib/cell-values";
import { selectRow, useBoardStore } from "@/store/board-store";
import { useGridStore } from "@/store/grid-store";
import { cn } from "@/lib/utils";
import type { BoardColumn, BoardColumnOf } from "@/types";

interface RecordCardProps {
  readonly rowId: string;
  readonly primaryColumnId: string;
  readonly fields: readonly BoardColumn[];
  readonly context: CellContext;
  readonly canDrag: boolean;
  readonly density?: "card" | "compact";
  readonly hierarchy?: HierarchyIndex;
  readonly completionColumn?: BoardColumnOf<"select"> | null;
  readonly onDragStart?: (rowId: string) => void;
  readonly onDragEnd?: () => void;
}

export const RecordCard = memo(function RecordCard({
  rowId,
  primaryColumnId,
  fields,
  context,
  canDrag,
  density = "card",
  hierarchy,
  completionColumn = null,
  onDragStart,
  onDragEnd,
}: RecordCardProps) {
  const row = useBoardStore(selectRow(rowId));
  const rowsById = useBoardStore((state) => state.rowsById);
  const isOpen = useGridStore((state) => state.drawerRowId === rowId);

  if (!row) return null;

  const title = row.cells[primaryColumnId];
  const label = title && title.kind === "text" ? title.value : "";
  const visible = fields.filter((column) => !isCellEmpty(cellOf(row, column))).slice(0, 3);

  const childIds = hierarchy ? childIdsOf(hierarchy, rowId) : [];
  const progress = hierarchy ? subtaskProgress(childIds, rowsById, completionColumn) : null;
  const isChild = isSubtask(row);

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
        row.isPending && "is-pending",
      )}
    >
      <div className="flex items-baseline gap-1.5">
        <span className="metric shrink-0 text-micro text-faint-foreground">{row.displayId}</span>
        <span
          className={cn(
            "min-w-0 flex-1 text-foreground",
            density === "card" ? "line-clamp-2 text-lead" : "truncate text-body",
          )}
        >
          {label || "Untitled"}
        </span>
      </div>

      {density === "card" && (childIds.length > 0 || isChild) && (
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          {childIds.length > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full border border-border bg-surface px-1.5 py-px text-micro text-muted-foreground">
              <ListTree className="size-2.5" />
              {childIds.length} subtask{childIds.length === 1 ? "" : "s"}
              {progress?.isMeasurable && (
                <span className="metric text-faint-foreground">
                  {progress.completed}/{progress.total} done
                </span>
              )}
            </span>
          )}

          {isChild && (
            <span className="rounded-full border border-hairline px-1.5 py-px text-micro text-faint-foreground">
              subtask
            </span>
          )}
        </div>
      )}

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
