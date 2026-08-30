"use client";

import { useEffect, useMemo, useState } from "react";
import { cellOf } from "@/lib/cell-values";
import { boardService } from "@/services/board-service";
import type { BoardColumn, BoardRow } from "@/types";

export interface RelationIndex {
  readonly labels: ReadonlyMap<string, string>;
  readonly isResolved: boolean;
}

const NO_TARGETS: RelationIndex = { labels: new Map(), isResolved: true };
const PENDING: RelationIndex = { labels: new Map(), isResolved: false };

interface Loaded {
  readonly key: string;
  readonly index: RelationIndex;
}

export function useRelationIndex(input: {
  readonly boardId: string;
  readonly columns: readonly BoardColumn[];
  readonly rows: readonly BoardRow[];
}): RelationIndex {
  const { boardId, columns, rows } = input;

  const referencedIds = useMemo(() => {
    const relationColumns = columns.filter((column) => column.type === "relation");

    if (relationColumns.length === 0) return [];

    const ids = new Set<string>();

    for (const row of rows) {
      for (const column of relationColumns) {
        const cell = cellOf(row, column);

        if (cell.kind !== "relation") continue;

        for (const rowId of cell.rowIds) ids.add(rowId);
      }
    }

    return [...ids].sort();
  }, [columns, rows]);

  const key = referencedIds.join(",");
  const [loaded, setLoaded] = useState<Loaded | null>(null);

  useEffect(() => {
    if (key.length === 0 || boardId === "") return undefined;

    const controller = new AbortController();

    boardService
      .relationIndex(boardId, key.split(","), controller.signal)
      .then((targets) => {
        if (controller.signal.aborted) return;

        const labels = new Map<string, string>();

        for (const target of targets) {
          labels.set(
            target.rowId,
            target.title ? `${target.displayId} · ${target.title}` : target.displayId,
          );
        }

        setLoaded({ key, index: { labels, isResolved: true } });
      })
      .catch(() => {
        if (!controller.signal.aborted) setLoaded({ key, index: PENDING });
      });

    return () => controller.abort();
  }, [key, boardId]);

  if (key.length === 0) return NO_TARGETS;

  return loaded?.key === key ? loaded.index : PENDING;
}
