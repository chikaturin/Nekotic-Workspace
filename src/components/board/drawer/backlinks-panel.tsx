"use client";

import { CornerUpLeft, Link2 } from "lucide-react";
import { useCallback } from "react";
import { useAsyncResource } from "@/hooks/use-async-resource";
import { boardService, type Backlink } from "@/services/board-service";
import { routableHref } from "@/lib/exported-routes";
import { hrefForNode } from "@/lib/tree";
import { getActiveTree } from "@/store/workspace-store";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

/**
 * DV-REL-24 — the other half of a relation.
 *
 * Nothing is stored for a backlink: it is derived by asking which rows point
 * here, so the two directions can never disagree.
 */
export function BacklinksPanel({ rowId }: { rowId: string }) {
  const loader = useCallback(
    (signal: AbortSignal) => boardService.listBacklinks(rowId, signal),
    [rowId],
  );

  const { state } = useAsyncResource<readonly Backlink[]>(loader, { keepPreviousData: true });
  const links = state.status === "success" ? state.data : [];
  // "Nothing links here" and "the lookup failed" are different facts, and only
  // one of them is about the record.
  const failure = state.status === "error" ? state.error : null;

  return (
    <section className="space-y-2">
      <h3 className="flex items-center gap-1.5 text-body font-semibold uppercase tracking-wider text-faint-foreground">
        <CornerUpLeft className="size-3.5" />
        Backlinks
        {links.length > 0 && <span className="metric normal-case">· {links.length}</span>}
      </h3>

      <ul className="space-y-1.5">
        {links.map((link) => (
          <li key={`${link.boardId}_${link.rowId}_${link.columnName}`}>
            <Link
              href={routableHref(hrefForNode(getActiveTree(), link.boardNodeId))}
              className="flex items-center gap-2 rounded-lg border border-border bg-surface px-2.5 py-2 no-underline hover:border-border-strong"
            >
              <Link2 className="size-3.5 shrink-0 text-faint-foreground" />
              <span className="metric shrink-0 text-micro text-faint-foreground">
                {link.displayId}
              </span>
              <span className="min-w-0 flex-1 truncate text-ui text-foreground">
                {link.title || "Untitled"}
              </span>
              <Badge variant="default" className="shrink-0">
                {link.boardName}
              </Badge>
            </Link>
            <p className="metric mt-0.5 pl-7 text-micro text-faint-foreground">
              via {link.columnName}
            </p>
          </li>
        ))}

        {failure && (
          <li className="text-ui text-danger">
            {failure.message}
            <span className="metric mt-0.5 block text-micro text-faint-foreground">
              Backlinks could not be read. Nothing was changed.
            </span>
          </li>
        )}

        {!failure && links.length === 0 && (
          <li className="text-ui text-faint-foreground">
            Nothing links here yet. Relations from other boards show up on their own.
          </li>
        )}
      </ul>
    </section>
  );
}
