"use client";

import { useEffect, useMemo, useState } from "react";
import { ApiDuplicateBanner } from "@/components/board/api-duplicate-banner";
import { ConflictNotices } from "@/components/board/conflict-notices";
import { BoardToolbar } from "@/components/board/board-toolbar";
import { BoardSettingsDrawer } from "@/components/board/settings/board-settings-drawer";
import { RowDrawer } from "@/components/board/drawer/row-drawer";
import { ExportDialog } from "@/components/board/export/export-dialog";
import { ImportDialog } from "@/components/board/import/import-dialog";
import { ArchivedBanner } from "@/components/shared/archived-banner";
import { TableGrid } from "@/components/board/table/table-grid";
import { CalendarBoard } from "@/components/board/views/calendar-board";
import { KanbanBoard } from "@/components/board/views/kanban-board";
import { GanttBoard } from "@/components/board/gantt/gantt-board";
import { ErrorState, ListLoadingState, PermissionDeniedState } from "@/components/shared/state-panels";
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

export function BoardPage({ node }: { node: BoardNode }) {
  const { status, error, reload } = useBoard(node.id);
  const model = useBoardView();
  const nodeCan = usePermissions(node);
  const archiveSource = useArchiveSource(node);
  const selectedMap = useGridStore(selectSelectedRowIds);

  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [exportScope, setExportScope] = useState<ExportScope | null>(null);

  const can = useMemo(
    () => (isArchivedNode(node) ? frozenResolver(nodeCan) : nodeCan),
    [nodeCan, node],
  );
  const canEdit = can("row.update");
  const rowsById = useBoardStore((state) => state.rowsById);

  const rowRequest = useWorkspaceStore((state) => state.rowRequest);
  const clearRowRequest = useWorkspaceStore((state) => state.clearRowRequest);
  const pushFeedback = useWorkspaceStore((state) => state.pushFeedback);
  const openDrawer = useGridStore((state) => state.openDrawer);
  const loadedNodeId = useBoardStore((state) => state.nodeId);

  useTrackRecent(useMemo(() => nodeRef(node), [node]));

  const selectedIds = useMemo(
    () => Object.keys(selectedMap).filter((rowId) => rowsById[rowId] !== undefined),
    [selectedMap, rowsById],
  );

  const exporter = useBoardExport({
    model,
    selectedIds,
    canViewSensitive: can("secret.reveal"),
  });

  useEffect(() => {
    if (!rowRequest || rowRequest.nodeId !== node.id) return;
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

  const duplicates = useMemo(() => {
    const pair = apiColumns(model.board, model.columns);
    if (!pair) return EMPTY_DUPLICATE_REPORT;

    return findDuplicateEndpoints(model.rowIds, rowsById, pair.endpoint, pair.method, model.context);
  }, [model.board, model.columns, model.rowIds, model.context, rowsById]);

  if (status === "loading" || status === "idle") {
    return (
      <div className="flex h-full flex-col">
        <div className="border-b border-border px-4 py-3">
          <p className="text-title font-semibold text-foreground">{node.name}</p>
          <p className="metric text-body text-faint-foreground">Loading records…</p>
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
        node={node}
        model={model}
        onReload={reload}
        can={can}
        onImport={() => setIsImportOpen(true)}
        onExport={() => setExportScope("board")}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      <ArchivedBanner
        source={archiveSource}
        subject={node}
        canRestore={nodeCan("node.archive")}
      />

      <ConflictNotices />

      <ApiDuplicateBanner report={duplicates} />

      {model.view?.type === "kanban" && <KanbanBoard model={model} canEdit={canEdit} />}
      {model.view?.type === "calendar" && <CalendarBoard model={model} canEdit={canEdit} />}
      {model.view?.type === "gantt" && <GanttBoard model={model} canEdit={canEdit} />}
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

      <BoardSettingsDrawer
        isOpen={isSettingsOpen}
        model={model}
        node={node}
        folderId={node.parentId}
        can={can}
        onClose={() => setIsSettingsOpen(false)}
      />

      <ImportDialog isOpen={isImportOpen} model={model} onClose={() => setIsImportOpen(false)} />

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
