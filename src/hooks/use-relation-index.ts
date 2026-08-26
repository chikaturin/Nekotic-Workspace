"use client";

import { useEffect, useMemo, useState } from "react";
import { boardService } from "@/services/board-service";
import type { BoardColumn } from "@/types";

export interface RelationIndex {
  /** Row id → label, across every board a relation column points at. */
  readonly labels: ReadonlyMap<string, string>;
  /**
   * True once every referenced board has answered. Until then a missing id is
   * simply unknown — never rendered as deleted.
   */
  readonly isResolved: boolean;
}

const NO_TARGETS: RelationIndex = { labels: new Map(), isResolved: true };
const PENDING: RelationIndex = { labels: new Map(), isResolved: false };

interface Loaded {
  readonly key: string;
  readonly index: RelationIndex;
}

/**
 * Resolves relation chips across boards.
 *
 * One request per target board rather than one per cell: a relation column
 * names its board, so a whole column resolves in a single call.
 */
export function useRelationIndex(columns: readonly BoardColumn[]): RelationIndex {
  const targetIds = useMemo(() => {
    const ids = new Set<string>();

    for (const column of columns) {
      if (column.type === "relation" && column.config.boardId) ids.add(column.config.boardId);
    }

    return [...ids].sort();
  }, [columns]);

  const key = targetIds.join("|");
  const [loaded, setLoaded] = useState<Loaded | null>(null);

  useEffect(() => {
    if (key.length === 0) return;

    const controller = new AbortController();
    const ids = key.split("|");

    Promise.all(ids.map((id) => boardService.relationIndex(id, controller.signal)))
      .then((results) => {
        if (controller.signal.aborted) return;

        const labels = new Map<string, string>();
        for (const targets of results) {
          for (const target of targets) {
            labels.set(
              target.rowId,
              target.title ? `${target.displayId} · ${target.title}` : target.displayId,
            );
          }
        }

        setLoaded({ key, index: { labels, isResolved: true } });
      })
      .catch(() => {
        if (!controller.signal.aborted) setLoaded({ key, index: PENDING });
      });

    return () => controller.abort();
  }, [key]);

  if (key.length === 0) return NO_TARGETS;
  return loaded?.key === key ? loaded.index : PENDING;
}
