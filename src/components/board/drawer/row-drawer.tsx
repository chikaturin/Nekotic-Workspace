"use client";

import { Archive, ArchiveRestore, Copy, CornerLeftUp, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { ActivityTimeline } from "@/components/board/drawer/activity-timeline";
import { DrawerTabs, type DrawerTabId } from "@/components/board/drawer/drawer-tabs";
import { WatchButton } from "@/components/collab/watch-button";
import { AttachmentPanel } from "@/components/board/drawer/attachment-panel";
import { BacklinksPanel } from "@/components/board/drawer/backlinks-panel";
import { SubtaskPanel } from "@/components/board/drawer/subtask-panel";
import { CommentPanel } from "@/components/comments/comment-panel";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { ESCAPE_OWNER_ATTRIBUTE } from "@/components/comments/mention-textarea";
import { DrawerField } from "@/components/board/drawer/drawer-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "@/components/ui/drawer";
import { Separator } from "@/components/ui/separator";
import type { BoardViewModel } from "@/hooks/use-board-view";
import { isRowArchived } from "@/lib/archive";
import { cellOf } from "@/lib/cell-values";
import { rowRef } from "@/lib/entity-ref";
import { formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { selectRow, useBoardStore } from "@/store/board-store";
import { useGridStore } from "@/store/grid-store";
import type { CellValue } from "@/types";

interface RowDrawerProps {
  readonly model: BoardViewModel;
  readonly folderId: string | null;
  readonly canEdit: boolean;
}

/**
 * Record detail.
 *
 * The drawer reads the same normalised record the grid renders and writes
 * through the same store action, so an edit here is visible in the row behind
 * it on the next frame — no syncing, no second copy of the data. Details,
 * Comments and Activity are tabs rather than a stack: all three stay mounted,
 * so switching to the history and back never costs a half-typed comment.
 */
export function RowDrawer({ model, folderId, canEdit }: RowDrawerProps) {
  const rowId = useGridStore((state) => state.drawerRowId);
  const closeDrawer = useGridStore((state) => state.closeDrawer);
  const row = useBoardStore(selectRow(rowId ?? ""));

  const editCells = useBoardStore((state) => state.editCells);
  const duplicateRow = useBoardStore((state) => state.duplicateRow);
  const deleteRow = useBoardStore((state) => state.deleteRow);
  const bulkArchive = useBoardStore((state) => state.bulkArchive);
  const createOption = useBoardStore((state) => state.createOption);
  const people = useBoardStore((state) => state.people);

  const [tab, setTab] = useState<DrawerTabId>("details");
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const { board, columns, context } = model;

  const title = useMemo(() => {
    if (!row || !board) return "";
    const value = row.cells[board.primaryColumnId];
    return value && value.kind === "text" ? value.value : "";
  }, [row, board]);

  /** The record this one sits under, when it is a subtask. */
  const parent = useBoardStore(selectRow(row?.parentRowId ?? ""));
  const parentTitle = useMemo(() => {
    if (!parent || !board) return "";
    const value = parent.cells[board.primaryColumnId];
    return value && value.kind === "text" ? value.value : "";
  }, [parent, board]);

  const isOpen = Boolean(rowId && row && board);
  const isArchived = row ? isRowArchived(row) : false;
  /** Archived records are frozen: readable, commentable, but not editable. */
  const isEditable = canEdit && !isArchived;

  /** The record's address: what the comment thread and the watch button follow. */
  const target = useMemo(
    () =>
      row && board
        ? rowRef({
            nodeId: board.nodeId,
            boardId: board.id,
            rowId: row.id,
            label: row.displayId,
          })
        : null,
    [row, board],
  );

  function commit(columnId: string, value: CellValue) {
    if (!rowId || !isEditable) return;
    void editCells([{ rowId, columnId, value }]);
  }

  return (
    <Drawer open={isOpen} onOpenChange={(open) => !open && closeDrawer()}>
      <DrawerContent
        aria-describedby={undefined}
        // A mention picker or a reply composer owns its own Escape; the drawer
        // only closes on presses nothing inside it claimed.
        onEscapeKeyDown={(event) => {
          const target = event.target;
          if (target instanceof Element && target.closest(`[${ESCAPE_OWNER_ATTRIBUTE}="true"]`)) {
            event.preventDefault();
          }
        }}
      >
        {row && board && (
          <>
            <header className="shrink-0 border-b border-border px-5 py-4 pr-12">
              <div className="flex items-center gap-2">
                <Badge variant="accent">{row.displayId}</Badge>
                {isArchived && (
                  <Badge variant="default">
                    <Archive className="size-3" />
                    archived
                  </Badge>
                )}
                {row.isPending && (
                  <span className="metric text-[10px] text-faint-foreground">saving…</span>
                )}
                <DrawerDescription className="metric ml-auto text-[10px] text-faint-foreground">
                  v{row.revision} · updated {formatRelativeTime(row.updatedAt)}
                </DrawerDescription>
                <WatchButton target={target} isCompact />
              </div>

              {parent && (
                <button
                  type="button"
                  onClick={() => useGridStore.getState().openDrawer(parent.id)}
                  className="mt-2 flex max-w-full items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
                >
                  <CornerLeftUp className="size-3 shrink-0" />
                  <span className="metric shrink-0">{parent.displayId}</span>
                  <span className="truncate">{parentTitle || "Untitled"}</span>
                </button>
              )}

              <DrawerTitle className="mt-2 truncate text-lg font-semibold tracking-tight text-foreground">
                {title || "Untitled record"}
              </DrawerTitle>
            </header>

            <DrawerTabs active={tab} onChange={setTab} />

            <div className="min-h-0 flex-1 overflow-y-auto">
              <section
                role="tabpanel"
                id="drawer-panel-details"
                aria-labelledby="drawer-tab-details"
                hidden={tab !== "details"}
                className="space-y-5 px-5 py-4"
              >
                {/* `inert` takes the fields out of the tab order too — a frozen
                    record must not be reachable by keyboard either. */}
                <div inert={isArchived} className={cn(isArchived && "opacity-70")}>
                  {columns.map((column) => (
                    <DrawerField
                      key={column.id}
                      column={column}
                      value={cellOf(row, column)}
                      context={context}
                      rowId={row.id}
                      boardId={board.id}
                      primaryColumnId={board.primaryColumnId}
                      folderId={folderId}
                      people={people}
                      columns={columns}
                      onCommit={(value) => commit(column.id, value)}
                      onCreateOption={(label) => createOption(column.id, label)}
                    />
                  ))}
                </div>

                <Separator />

                {/* Subtasks are records, so they sit beside the fields rather
                    than inside one — and commenting/attaching on a subtask
                    happens in that subtask's own drawer. */}
                <SubtaskPanel
                  parentRowId={row.id}
                  parentDisplayId={row.displayId}
                  columns={columns}
                  primaryColumnId={board.primaryColumnId}
                  context={context}
                  people={people}
                  canEdit={isEditable}
                />

                <Separator />
                <AttachmentPanel
                  rowId={row.id}
                  columns={columns}
                  folderId={folderId}
                  canEdit={isEditable}
                />

                <Separator />
                {/* Relations are dependencies, not containment — kept apart
                    from Subtasks on purpose. */}
                <BacklinksPanel rowId={row.id} />
              </section>

              <section
                role="tabpanel"
                id="drawer-panel-comments"
                aria-labelledby="drawer-tab-comments"
                hidden={tab !== "comments"}
                className="px-5 py-4"
              >
                {/* Commenting is not editing: a frozen record still takes one. */}
                {target && <CommentPanel target={target} people={people} canComment={canEdit} />}
              </section>

              <section
                role="tabpanel"
                id="drawer-panel-activity"
                aria-labelledby="drawer-tab-activity"
                hidden={tab !== "activity"}
              >
                <ActivityTimeline boardId={board.id} rowId={row.id} />
              </section>
            </div>

            <footer className="flex shrink-0 items-center gap-2 border-t border-border px-5 py-3">
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                disabled={!isEditable}
                onClick={() => void duplicateRow(row.id)}
              >
                <Copy />
                Duplicate
              </Button>

              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                disabled={!canEdit}
                onClick={() => void bulkArchive([row.id], !isArchived)}
              >
                {isArchived ? <ArchiveRestore /> : <Archive />}
                {isArchived ? "Restore" : "Archive"}
              </Button>

              <Button
                size="sm"
                variant="danger"
                className="gap-1.5"
                disabled={!canEdit}
                onClick={() => setIsConfirmingDelete(true)}
              >
                <Trash2 />
                Delete
              </Button>

              <span className="metric ml-auto text-[10px] text-faint-foreground">
                {isArchived ? "Archived — read-only" : "Edits save as you make them"}
              </span>
            </footer>
          </>
        )}
      </DrawerContent>

      {/* Same wording as the grid and the bulk bar: one sentence, one verb,
          and the same reason the Trash cannot help here. */}
      <ConfirmDialog
        isOpen={isConfirmingDelete}
        title={row ? `Delete ${row.displayId}?` : "Delete record?"}
        description="Records are removed outright — the Trash holds files, pages and boards, not rows. This cannot be undone."
        confirmLabel="Delete record"
        onClose={() => setIsConfirmingDelete(false)}
        onConfirm={() => {
          setIsConfirmingDelete(false);
          closeDrawer();
          if (row) void deleteRow(row.id);
        }}
      />
    </Drawer>
  );
}
