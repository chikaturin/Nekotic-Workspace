"use client";

import { RotateCcw, Trash2, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/drive/empty-state";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { TRASH_RETENTION_DAYS } from "@/config/app";
import { usePermissions } from "@/hooks/use-permissions";
import { useTrash, type TrashRow } from "@/hooks/use-trash";
import { formatCount, formatRelativeTime } from "@/lib/format";
import { nodeVisual } from "@/lib/node-visuals";
import { useWorkspaceStore } from "@/store/workspace-store";
import { cn } from "@/lib/utils";

export function TrashPage() {
  const rows = useTrash();
  const restoreNode = useWorkspaceStore((state) => state.restoreNode);
  const deleteForever = useWorkspaceStore((state) => state.deleteForever);
  const emptyTrash = useWorkspaceStore((state) => state.emptyTrash);

  const [purging, setPurging] = useState<TrashRow | null>(null);
  const [isEmptying, setIsEmptying] = useState(false);

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-3 border-b border-border bg-background/80 px-4 py-3 backdrop-blur">
        <span className="flex size-9 items-center justify-center rounded-lg border border-border bg-surface">
          <Trash2 className="size-4 text-accent" />
        </span>

        <div className="min-w-0 flex-1">
          <h1 className="truncate text-title font-semibold tracking-tight text-foreground">Trash</h1>
          <p className="metric truncate text-body text-faint-foreground">
            Deleted items are kept for {TRASH_RETENTION_DAYS} days ·{" "}
            {formatCount(rows.length, "item")}
          </p>
        </div>

        {rows.length > 0 && (
          <Button
            size="sm"
            variant="danger"
            className="gap-1.5"
            onClick={() => setIsEmptying(true)}
          >
            <Trash2 />
            Empty trash
          </Button>
        )}
      </header>

      <div className="canvas-grid min-h-0 flex-1 overflow-y-auto bg-canvas p-4">
        {rows.length === 0 ? (
          <EmptyState
            icon={Trash2}
            title="Trash is empty"
            description={`Deleted folders, pages, boards and files wait here for ${TRASH_RETENTION_DAYS} days before they are swept.`}
            action={{ label: "Go to Drive", href: "/drive" }}
          />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border bg-background">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-border bg-surface text-body uppercase tracking-wider text-faint-foreground">
                  <th className="p-2.5 font-medium">Item</th>
                  <th className="p-2.5 font-medium">Original location</th>
                  <th className="p-2.5 font-medium">Deleted</th>
                  <th className="p-2.5 font-medium">By</th>
                  <th className="p-2.5 font-medium">Purges in</th>
                  <th className="w-px p-2.5" />
                </tr>
              </thead>

              <tbody>
                {rows.map((row) => (
                  <TrashTableRow
                    key={row.entry.id}
                    row={row}
                    onRestore={() => restoreNode(row.entry.id)}
                    onPurge={() => setPurging(row)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ConfirmDialog
        isOpen={purging !== null}
        title={`Delete “${purging?.entry.node.name ?? ""}” permanently?`}
        description="This removes the item and everything inside it for good. It cannot be restored afterwards."
        confirmLabel="Delete permanently"
        onClose={() => setPurging(null)}
        onConfirm={() => {
          if (purging) deleteForever(purging.entry.id);
          setPurging(null);
        }}
      />

      <ConfirmDialog
        isOpen={isEmptying}
        title={`Empty the trash?`}
        description={`All ${formatCount(rows.length, "item")} will be deleted for good, along with everything inside them.`}
        confirmLabel="Empty trash"
        onClose={() => setIsEmptying(false)}
        onConfirm={() => {
          emptyTrash();
          setIsEmptying(false);
        }}
      />
    </div>
  );
}

function TrashTableRow({
  row,
  onRestore,
  onPurge,
}: {
  readonly row: TrashRow;
  readonly onRestore: () => void;
  readonly onPurge: () => void;
}) {
  const can = usePermissions(row.entry.node);
  const visual = nodeVisual(row.entry.node);
  const canRestore = can("node.delete");

  return (
    <tr className="border-b border-hairline last:border-0 hover:bg-hover">
      <td className="max-w-64 p-2.5">
        <span className="flex items-center gap-2">
          <visual.Icon className={cn("size-4 shrink-0", visual.colorClass)} />
          <span className="min-w-0">
            <span className="block truncate text-lead text-foreground">
              {row.entry.node.name}
            </span>
            <span className="metric block text-micro text-faint-foreground">{visual.label}</span>
          </span>
        </span>
      </td>

      <td className="max-w-56 p-2.5">
        <span className="block truncate text-ui text-muted-foreground">
          {row.entry.originalPath}
        </span>
        {row.willRelocate && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="mt-0.5 inline-flex items-center gap-1 text-micro text-warning">
                <TriangleAlert className="size-3" />
                folder is gone
              </span>
            </TooltipTrigger>
            <TooltipContent>
              Restoring puts it in {row.restoreLocation} instead
            </TooltipContent>
          </Tooltip>
        )}
      </td>

      <td className="metric whitespace-nowrap p-2.5 text-body text-muted-foreground">
        {formatRelativeTime(row.entry.deletedAt)}
      </td>

      <td className="p-2.5">
        <span className="flex items-center gap-1.5">
          <UserAvatar user={row.entry.deletedBy} className="size-5" />
          <span className="truncate text-ui text-muted-foreground">
            {row.entry.deletedBy.name}
          </span>
        </span>
      </td>

      <td className="whitespace-nowrap p-2.5">
        {row.daysLeft === null ? (
          <Badge variant="danger">due</Badge>
        ) : (
          <Badge variant={row.daysLeft <= 3 ? "danger" : "default"}>
            {formatCount(row.daysLeft, "day")}
          </Badge>
        )}
      </td>

      <td className="whitespace-nowrap p-2.5 text-right">
        {canRestore ? (
          <>
            <Button size="sm" variant="outline" className="gap-1.5" onClick={onRestore}>
              <RotateCcw />
              Restore
            </Button>
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label={`Delete ${row.entry.node.name} permanently`}
              className="ml-1 text-danger"
              onClick={onPurge}
            >
              <Trash2 />
            </Button>
          </>
        ) : (
          <span className="metric text-micro text-faint-foreground">
            only its owner can restore this
          </span>
        )}
      </td>
    </tr>
  );
}
