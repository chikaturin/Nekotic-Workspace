"use client";

import { LayoutGrid, LoaderCircle } from "lucide-react";
import { useCallback, useState } from "react";
import { useAsyncResource } from "@/hooks/use-async-resource";
import { AsyncBoundary } from "@/components/shared/async-boundary";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCount } from "@/lib/format";
import { boardService, type BoardDescriptor } from "@/services/board-service";
import { cn } from "@/lib/utils";

interface BulkMoveDialogProps {
  readonly isOpen: boolean;
  readonly count: number;
  /** The board the records are on now — never a destination. */
  readonly currentBoardId: string;
  readonly isBusy: boolean;
  readonly onMove: (targetNodeId: string, targetName: string) => void;
  readonly onClose: () => void;
}

/**
 * Choosing a destination board.
 *
 * The list comes from the drive tree, so naming a board never seeds its
 * records — a 5.000-record board costs nothing to *offer* as a destination.
 */
export function BulkMoveDialog({
  isOpen,
  count,
  currentBoardId,
  isBusy,
  onMove,
  onClose,
}: BulkMoveDialogProps) {
  const [targetId, setTargetId] = useState<string | null>(null);

  const loader = useCallback((signal: AbortSignal) => boardService.listBoards(signal), []);
  const { state, reload } = useAsyncResource<readonly BoardDescriptor[]>(loader, {
    enabled: isOpen,
  });

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md p-0">
        <header className="border-b border-border px-5 py-4 pr-12">
          <DialogTitle className="text-sm font-semibold text-foreground">
            Move {formatCount(count, "record")}
          </DialogTitle>
          <DialogDescription className="mt-1 text-[12px] text-muted-foreground">
            Columns are matched by name. Anything the destination has no column for is
            reported before it is dropped.
          </DialogDescription>
        </header>

        <div className="max-h-80 overflow-y-auto p-2">
          <AsyncBoundary state={state} onRetry={reload} loading={<BoardsSkeleton />}>
            {(boards) => {
              const destinations = boards.filter((board) => board.boardId !== currentBoardId);

              if (destinations.length === 0) {
                return (
                  <p className="px-3 py-6 text-center text-[12px] text-faint-foreground">
                    There is no other board in this workspace to move to.
                  </p>
                );
              }

              return (
                <ul className="space-y-0.5">
                  {destinations.map((board) => (
                    <li key={board.boardId}>
                      <button
                        type="button"
                        onClick={() => setTargetId(board.nodeId)}
                        className={cn(
                          "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[12px] transition-colors",
                          targetId === board.nodeId
                            ? "bg-accent-soft text-accent"
                            : "text-foreground hover:bg-hover",
                        )}
                      >
                        <LayoutGrid className="size-3.5 shrink-0" />
                        <span className="min-w-0 flex-1 truncate">{board.name}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              );
            }}
          </AsyncBoundary>
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-border px-5 py-3">
          <Button size="sm" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            variant="default"
            className="gap-1.5"
            disabled={targetId === null || isBusy}
            onClick={() => {
              if (!targetId) return;
              const name = boardNameFor(state.status === "success" ? state.data : [], targetId);
              onMove(targetId, name);
            }}
          >
            {isBusy && <LoaderCircle className="animate-spin" />}
            Move records
          </Button>
        </footer>
      </DialogContent>
    </Dialog>
  );
}

function boardNameFor(boards: readonly BoardDescriptor[], nodeId: string): string {
  return boards.find((board) => board.nodeId === nodeId)?.name ?? "that board";
}

function BoardsSkeleton() {
  return (
    <div className="space-y-1.5 p-2" aria-busy="true">
      {[0, 1, 2].map((index) => (
        <Skeleton key={index} className="h-8 rounded-lg" />
      ))}
    </div>
  );
}
