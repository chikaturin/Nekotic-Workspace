"use client";

import { ExternalLink, LayoutGrid, RotateCcw, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { CellEditor } from "@/components/board/cells/cell-editor";
import { CellRenderer } from "@/components/board/cells/cell-renderer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SelectField } from "@/components/ui/select-field";
import { Skeleton } from "@/components/ui/skeleton";
import { useBoardList } from "@/hooks/use-board-list";
import { useEmbeddedBoard } from "@/hooks/use-embedded-board";
import { routableHref } from "@/lib/exported-routes";
import { cellOf } from "@/lib/cell-values";
import { formatCount } from "@/lib/format";
import { hrefForNode } from "@/lib/tree";
import { getActiveTree } from "@/store/workspace-store";
import { cn } from "@/lib/utils";
import type { EmbedBlock as EmbedBlockModel } from "@/types";

interface EmbedBlockProps {
  readonly block: EmbedBlockModel;
  readonly onChange: (block: EmbedBlockModel) => void;
  readonly isEditable: boolean;
}

/** Rows mounted inside a document. The source board holds the rest. */
const EMBED_ROW_LIMIT = 12;

/**
 * DV-EMB-25 — a saved view of a board, embedded in a page.
 *
 * The block stores two ids and nothing else. Columns, filters, sorting and the
 * cell renderers all come from the board engine, and an edit here writes to the
 * source board rather than to the document.
 */
export function EmbedBlock({ block, onChange, isEditable }: EmbedBlockProps) {
  const boards = useBoardList();
  const embed = useEmbeddedBoard(block.boardNodeId, block.viewId);
  const [editing, setEditing] = useState<{ rowId: string; columnId: string } | null>(null);

  if (!block.boardNodeId) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-surface/60 p-5 text-center">
        <LayoutGrid className="mx-auto size-6 text-faint-foreground" strokeWidth={1.5} />
        <p className="mt-2 text-[13px] text-muted-foreground">Choose a board to embed</p>

        <SelectField
          aria-label="Board to embed"
          value=""
          disabled={!isEditable}
          onChange={(event) =>
            onChange({ ...block, boardNodeId: event.target.value || null, viewId: null })
          }
          className="mx-auto mt-2 h-8 w-64"
        >
          <option value="">Select a board…</option>
          {boards.map((board) => (
            <option key={board.nodeId} value={board.nodeId}>
              {board.name}
            </option>
          ))}
        </SelectField>
      </div>
    );
  }

  if (embed.status === "loading") {
    return (
      <div className="space-y-2 rounded-lg border border-border bg-surface p-3" aria-busy="true">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
      </div>
    );
  }

  if (embed.status === "missing") {
    return (
      <div className="rounded-lg border border-danger/30 bg-danger/10 p-4">
        <p className="flex items-center gap-1.5 text-[13px] font-medium text-danger">
          <TriangleAlert className="size-4" />
          This board no longer exists
        </p>
        <p className="mt-1 text-[12px] text-muted-foreground">
          The embedded view points at a board that has been deleted or moved out of reach. The
          page itself is unaffected.
        </p>
        {isEditable && (
          <Button
            size="sm"
            variant="outline"
            className="mt-2"
            onClick={() => onChange({ ...block, boardNodeId: null, viewId: null })}
          >
            Choose another board
          </Button>
        )}
      </div>
    );
  }

  if (embed.status === "error") {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-border bg-surface p-3">
        <TriangleAlert className="size-4 shrink-0 text-warning" />
        <span className="min-w-0 flex-1 truncate text-[12px] text-muted-foreground">
          {embed.message ?? "The board could not be loaded"}
        </span>
        <Button size="sm" variant="ghost" className="gap-1.5" onClick={embed.reload}>
          <RotateCcw />
          Retry
        </Button>
      </div>
    );
  }

  const rows = embed.rowIds.slice(0, EMBED_ROW_LIMIT);
  const hidden = embed.rowIds.length - rows.length;
  const href = embed.board ? routableHref(hrefForNode(getActiveTree(), embed.board.nodeId)) : "#";

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface">
      <header className="flex flex-wrap items-center gap-2 border-b border-hairline px-3 py-2">
        <LayoutGrid className="size-3.5 shrink-0 text-faint-foreground" />
        <span className="text-[12px] font-medium text-foreground">{embed.board?.name}</span>

        <SelectField
          aria-label="Saved view"
          value={embed.view?.id ?? ""}
          disabled={!isEditable}
          onChange={(event) => onChange({ ...block, viewId: event.target.value })}
          className="h-6 text-[11px]"
        >
          {embed.board?.views.map((view) => (
            <option key={view.id} value={view.id}>
              {view.name}
            </option>
          ))}
        </SelectField>

        <Badge variant="default">{formatCount(embed.rowIds.length, "record")}</Badge>

        <Link
          href={href}
          className="ml-auto flex items-center gap-1 text-[11px] text-accent no-underline hover:underline"
        >
          Open board
          <ExternalLink className="size-3" />
        </Link>
      </header>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[12px]">
          <thead>
            <tr>
              {embed.columns.map((column) => (
                <th
                  key={column.id}
                  scope="col"
                  className="border-b border-hairline px-2 py-1.5 text-left text-[10px] font-medium uppercase tracking-wider text-faint-foreground"
                >
                  {column.name}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {rows.map((rowId) => {
              const row = embed.rowsById[rowId];
              if (!row) return null;

              return (
                <tr key={rowId} className="group/embed">
                  {embed.columns.map((column) => {
                    const isEditingCell =
                      editing?.rowId === rowId && editing.columnId === column.id;

                    return (
                      <td
                        key={column.id}
                        onDoubleClick={() =>
                          isEditable && setEditing({ rowId, columnId: column.id })
                        }
                        className={cn(
                          "relative border-b border-hairline align-top",
                          isEditable && "hover:bg-hover",
                        )}
                      >
                        {isEditingCell ? (
                          <CellEditor
                            value={cellOf(row, column)}
                            column={column}
                            rowId={rowId}
                            boardId={embed.board?.id ?? ""}
                            primaryColumnId={embed.board?.primaryColumnId ?? ""}
                            folderId={null}
                            people={[]}
                            columns={embed.columns}
                            context={embed.context}
                            onCommit={(value) => {
                              void embed.editCell(rowId, column.id, value);
                              setEditing(null);
                            }}
                            onCancel={() => setEditing(null)}
                            onCreateOption={() => Promise.resolve(null)}
                          />
                        ) : (
                          <CellRenderer
                            value={cellOf(row, column)}
                            column={column}
                            context={embed.context}
                          />
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <footer className="flex items-center gap-2 border-t border-hairline px-3 py-1.5">
        <span className="metric text-[10px] text-faint-foreground">
          Live from the board · edits here write to the source
        </span>
        {hidden > 0 && (
          <Link href={href} className="metric ml-auto text-[10px] text-accent no-underline">
            {hidden} more in the board
          </Link>
        )}
      </footer>
    </div>
  );
}
