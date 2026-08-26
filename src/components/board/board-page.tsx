"use client";

import { TriangleAlert, X } from "lucide-react";
import { useMemo } from "react";
import { ApiDuplicateBanner } from "@/components/board/api-duplicate-banner";
import { BoardToolbar } from "@/components/board/board-toolbar";
import { RowDrawer } from "@/components/board/drawer/row-drawer";
import { TableGrid } from "@/components/board/table/table-grid";
import { CalendarBoard } from "@/components/board/views/calendar-board";
import { KanbanBoard } from "@/components/board/views/kanban-board";
import { TimelineBoard } from "@/components/board/views/timeline-board";
import { ErrorState, ListLoadingState, PermissionDeniedState } from "@/components/shared/state-panels";
import { Button } from "@/components/ui/button";
import { useBoard } from "@/hooks/use-board";
import { useBoardView } from "@/hooks/use-board-view";
import { useCapabilities } from "@/hooks/use-capabilities";
import {
  apiColumns,
  EMPTY_DUPLICATE_REPORT,
  findDuplicateEndpoints,
} from "@/lib/api-catalog";
import { useBoardStore } from "@/store/board-store";
import type { BoardNode } from "@/types";

/**
 * Board surface for a board node.
 *
 * One board, one record set, many views. The toolbar switches saved views and
 * the table renders the current one; Kanban, Calendar and Timeline plug into
 * the same `useBoardView` query when they land.
 */
export function BoardPage({ node }: { node: BoardNode }) {
  const { status, error, reload } = useBoard(node.id);
  const model = useBoardView();
  const capabilities = useCapabilities(node);
  const conflicts = useBoardStore((state) => state.conflicts);
  const dismissConflict = useBoardStore((state) => state.dismissConflict);
  const rowsById = useBoardStore((state) => state.rowsById);

  /** API boards check their own catalogue for duplicate endpoint + method. */
  const duplicates = useMemo(() => {
    const pair = apiColumns(model.board, model.columns);
    if (!pair) return EMPTY_DUPLICATE_REPORT;

    return findDuplicateEndpoints(model.rowIds, rowsById, pair.endpoint, pair.method, model.context);
  }, [model.board, model.columns, model.rowIds, model.context, rowsById]);

  if (status === "loading" || status === "idle") {
    return (
      <div className="flex h-full flex-col">
        <div className="border-b border-border px-4 py-3">
          <p className="text-base font-semibold text-foreground">{node.name}</p>
          <p className="metric text-[11px] text-faint-foreground">Loading records…</p>
        </div>
        <div className="min-h-0 flex-1 p-4">
          <ListLoadingState />
        </div>
      </div>
    );
  }

  if (status === "error" && error) {
    return error.code === "permission_denied" ? (
      <PermissionDeniedState error={error} />
    ) : (
      <ErrorState error={error} onRetry={reload} />
    );
  }

  return (
    <div className="flex h-full flex-col">
      <BoardToolbar model={model} onReload={reload} />

      {conflicts.length > 0 && (
        <ul className="shrink-0 divide-y divide-hairline border-b border-warning/30 bg-warning/10">
          {conflicts.map((conflict) => (
            <li key={conflict.id} className="flex items-center gap-2 px-4 py-1.5">
              <TriangleAlert className="size-3.5 shrink-0 text-warning" />
              <span className="min-w-0 flex-1 truncate text-[12px] text-foreground">
                {conflict.message}
              </span>
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label="Dismiss"
                onClick={() => dismissConflict(conflict.id)}
              >
                <X />
              </Button>
            </li>
          ))}
        </ul>
      )}

      {/* Every view renders the same records; only the reading changes. */}
      <ApiDuplicateBanner report={duplicates} />

      {model.view?.type === "kanban" && <KanbanBoard model={model} canEdit={capabilities.edit} />}
      {model.view?.type === "calendar" && (
        <CalendarBoard model={model} canEdit={capabilities.edit} />
      )}
      {model.view?.type === "timeline" && (
        <TimelineBoard model={model} canEdit={capabilities.edit} />
      )}
      {(model.view?.type === "table" || !model.view) && (
        <TableGrid model={model} folderId={node.parentId} warnedRowIds={duplicates.rowIds} />
      )}

      <RowDrawer model={model} folderId={node.parentId} />
    </div>
  );
}
