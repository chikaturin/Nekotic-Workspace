"use client";

import { TriangleAlert, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ApiDuplicateBanner } from "@/components/board/api-duplicate-banner";
import { BoardToolbar } from "@/components/board/board-toolbar";
import { RowDrawer } from "@/components/board/drawer/row-drawer";
import { ExportDialog } from "@/components/board/export/export-dialog";
import { ImportDialog } from "@/components/board/import/import-dialog";
import { ArchivedBanner } from "@/components/shared/archived-banner";
import { TableGrid } from "@/components/board/table/table-grid";
import { CalendarBoard } from "@/components/board/views/calendar-board";
import { KanbanBoard } from "@/components/board/views/kanban-board";
import { TimelineBoard } from "@/components/board/views/timeline-board";
import { ErrorState, ListLoadingState, PermissionDeniedState } from "@/components/shared/state-panels";
import { Button } from "@/components/ui/button";
import { useBoard } from "@/hooks/use-board";
import { useBoardView } from "@/hooks/use-board-view";
import { useBoardExport } from "@/hooks/use-board-export";
import { useArchiveSource, usePermissions } from "@/hooks/use-permissions";
import {
  apiColumns,
  EMPTY_DUPLICATE_REPORT,
  findDuplicateEndpoints,
} from "@/lib/api-catalog";
import { useTrackRecent } from "@/hooks/use-recent";
import { nodeRef } from "@/lib/entity-ref";
import { isArchivedNode } from "@/lib/archive";
import { frozenResolver } from "@/lib/permissions";
import { useBoardStore } from "@/store/board-store";
import { selectSelectedRowIds, useGridStore } from "@/store/grid-store";
import { useWorkspaceStore } from "@/store/workspace-store";
import type { BoardNode, ExportScope } from "@/types";

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
  const nodeCan = usePermissions(node);
  const archiveSource = useArchiveSource(node);
  const selectedMap = useGridStore(selectSelectedRowIds);

  const [isImportOpen, setIsImportOpen] = useState(false);
  const [exportScope, setExportScope] = useState<ExportScope | null>(null);

  /**
   * A board archived in its own right freezes here; an ancestor's freeze is
   * already closed inside the resolver. Wrapping rather than passing a flag
   * keeps every gate below reading from one answer.
   */
  const can = useMemo(
    () => (isArchivedNode(node) ? frozenResolver(nodeCan) : nodeCan),
    [nodeCan, node],
  );
  const canEdit = can("row.update");
  const conflicts = useBoardStore((state) => state.conflicts);
  const dismissConflict = useBoardStore((state) => state.dismissConflict);
  const rowsById = useBoardStore((state) => state.rowsById);

  const rowRequest = useWorkspaceStore((state) => state.rowRequest);
  const clearRowRequest = useWorkspaceStore((state) => state.clearRowRequest);
  const pushFeedback = useWorkspaceStore((state) => state.pushFeedback);
  const openDrawer = useGridStore((state) => state.openDrawer);
  /** Which board the store actually holds — "ready" alone can mean the last one. */
  const loadedNodeId = useBoardStore((state) => state.nodeId);

  useTrackRecent(useMemo(() => nodeRef(node), [node]));

  const selectedIds = useMemo(
    () => Object.keys(selectedMap).filter((rowId) => rowsById[rowId] !== undefined),
    [selectedMap, rowsById],
  );

  const exporter = useBoardExport({
    model,
    selectedIds,
    // Columns that look like credentials only leave the workspace with someone
    // who is allowed to read a secret in the first place.
    canViewSensitive: can("secret.reveal"),
  });

  /**
   * A notification, a search hit or a My Work card can ask for one record.
   * The request survives the navigation in the workspace store because the
   * grid store is reset for every board that loads.
   */
  useEffect(() => {
    if (!rowRequest || rowRequest.nodeId !== node.id) return;
    // Navigating between boards re-renders with the new node while the store
    // still holds the previous board's records. Wait for this board's own.
    if (status !== "ready" || loadedNodeId !== node.id) return;

    if (rowsById[rowRequest.rowId]) openDrawer(rowRequest.rowId);
    else pushFeedback("That record is no longer on this board", "error");

    clearRowRequest();
  }, [
    rowRequest,
    node.id,
    status,
    loadedNodeId,
    rowsById,
    openDrawer,
    clearRowRequest,
    pushFeedback,
  ]);

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
      <BoardToolbar
        model={model}
        onReload={reload}
        can={can}
        onImport={() => setIsImportOpen(true)}
        onExport={() => setExportScope("board")}
      />

      {/* Deliberately the unfrozen resolver: `can` refuses every write on a
          board archived in its own right, and Restore is the one write that
          has to survive that — otherwise nothing could ever be un-archived. */}
      <ArchivedBanner
        source={archiveSource}
        subject={node}
        canRestore={nodeCan("node.archive")}
      />

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

      {model.view?.type === "kanban" && <KanbanBoard model={model} canEdit={canEdit} />}
      {model.view?.type === "calendar" && <CalendarBoard model={model} canEdit={canEdit} />}
      {/* The roadmap is read-only: dates change on the record, not by dragging. */}
      {model.view?.type === "timeline" && <TimelineBoard model={model} />}
      {(model.view?.type === "table" || !model.view) && (
        <TableGrid
          model={model}
          folderId={node.parentId}
          warnedRowIds={duplicates.rowIds}
          can={can}
          onExportSelection={() => setExportScope("selection")}
        />
      )}

      <RowDrawer model={model} folderId={node.parentId} canEdit={canEdit} />

      <ImportDialog isOpen={isImportOpen} model={model} onClose={() => setIsImportOpen(false)} />

      {/* Keyed on the scope it was opened with: the toolbar opens it on the
          whole board, the bulk bar on the selection, and a remount is what
          makes the dialog actually start on the right one. */}
      <ExportDialog
        key={exportScope ?? "closed"}
        isOpen={exportScope !== null}
        controller={exporter}
        initialScope={exportScope ?? "board"}
        onClose={() => setExportScope(null)}
      />
    </div>
  );
}
