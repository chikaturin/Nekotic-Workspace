"use client";

import { Copy, Trash2 } from "lucide-react";
import { useMemo } from "react";
import { ActivityPanel } from "@/components/board/drawer/activity-panel";
import { BacklinksPanel } from "@/components/board/drawer/backlinks-panel";
import { CommentsPanel } from "@/components/board/drawer/comments-panel";
import { DrawerField } from "@/components/board/drawer/drawer-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "@/components/ui/drawer";
import { Separator } from "@/components/ui/separator";
import type { BoardViewModel } from "@/hooks/use-board-view";
import { cellOf } from "@/lib/cell-values";
import { formatRelativeTime } from "@/lib/format";
import { selectRow, useBoardStore } from "@/store/board-store";
import { useGridStore } from "@/store/grid-store";
import type { CellValue } from "@/types";

interface RowDrawerProps {
  readonly model: BoardViewModel;
  readonly folderId: string | null;
}

/**
 * Record detail.
 *
 * The drawer reads the same normalised record the grid renders and writes
 * through the same store action, so an edit here is visible in the row behind
 * it on the next frame — no syncing, no second copy of the data.
 */
export function RowDrawer({ model, folderId }: RowDrawerProps) {
  const rowId = useGridStore((state) => state.drawerRowId);
  const closeDrawer = useGridStore((state) => state.closeDrawer);
  const row = useBoardStore(selectRow(rowId ?? ""));

  const editCells = useBoardStore((state) => state.editCells);
  const duplicateRow = useBoardStore((state) => state.duplicateRow);
  const deleteRow = useBoardStore((state) => state.deleteRow);
  const createOption = useBoardStore((state) => state.createOption);
  const people = useBoardStore((state) => state.people);

  const { board, columns, context } = model;

  const title = useMemo(() => {
    if (!row || !board) return "";
    const value = row.cells[board.primaryColumnId];
    return value && value.kind === "text" ? value.value : "";
  }, [row, board]);

  const isOpen = Boolean(rowId && row && board);

  function commit(columnId: string, value: CellValue) {
    if (!rowId) return;
    void editCells([{ rowId, columnId, value }]);
  }

  return (
    <Drawer open={isOpen} onOpenChange={(open) => !open && closeDrawer()}>
      <DrawerContent aria-describedby={undefined}>
        {row && board && (
          <>
            <header className="shrink-0 border-b border-border px-5 py-4 pr-12">
              <div className="flex items-center gap-2">
                <Badge variant="accent">{row.displayId}</Badge>
                {row.isPending && (
                  <span className="metric text-[10px] text-faint-foreground">saving…</span>
                )}
                <DrawerDescription className="metric ml-auto text-[10px] text-faint-foreground">
                  v{row.revision} · updated {formatRelativeTime(row.updatedAt)}
                </DrawerDescription>
              </div>

              <DrawerTitle className="mt-2 truncate text-lg font-semibold tracking-tight text-foreground">
                {title || "Untitled record"}
              </DrawerTitle>
            </header>

            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4">
              <div>
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
                    onCommit={(value) => commit(column.id, value)}
                    onCreateOption={(label) => createOption(column.id, label)}
                  />
                ))}
              </div>

              <Separator />
              <BacklinksPanel rowId={row.id} />

              <Separator />
              <CommentsPanel boardId={board.id} rowId={row.id} />

              <Separator />
              <ActivityPanel boardId={board.id} rowId={row.id} />
            </div>

            <footer className="flex shrink-0 items-center gap-2 border-t border-border px-5 py-3">
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                onClick={() => void duplicateRow(row.id)}
              >
                <Copy />
                Duplicate
              </Button>
              <Button
                size="sm"
                variant="danger"
                className="gap-1.5"
                onClick={() => {
                  closeDrawer();
                  void deleteRow(row.id);
                }}
              >
                <Trash2 />
                Delete
              </Button>
              <span className="metric ml-auto text-[10px] text-faint-foreground">
                Edits save as you make them
              </span>
            </footer>
          </>
        )}
      </DrawerContent>
    </Drawer>
  );
}
