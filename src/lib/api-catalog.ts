import { cellOf, cellText, type CellContext } from "@/lib/cell-values";
import type { RowMap } from "@/lib/board-records";
import type { Board, BoardColumn } from "@/types";

export interface DuplicateGroup {
  readonly key: string;
  readonly endpoint: string;
  readonly method: string;
  readonly rowIds: readonly string[];
}

export interface DuplicateReport {
  readonly groups: readonly DuplicateGroup[];
  readonly rowIds: ReadonlySet<string>;
}

export const EMPTY_DUPLICATE_REPORT: DuplicateReport = { groups: [], rowIds: new Set() };

export function apiColumns(
  board: Board | null,
  columns: readonly BoardColumn[],
): { readonly endpoint: BoardColumn; readonly method: BoardColumn } | null {
  if (!board || board.templateId !== "apiDocs") return null;

  const endpoint = columns.find((column) => column.id === board.primaryColumnId);
  const method = columns.find(
    (column) => column.type === "select" && column.name.toLowerCase() === "method",
  );

  return endpoint && method ? { endpoint, method } : null;
}

export function findDuplicateEndpoints(
  rowIds: readonly string[],
  rows: RowMap,
  endpoint: BoardColumn,
  method: BoardColumn,
  context: CellContext = {},
): DuplicateReport {
  const byKey = new Map<string, { endpoint: string; method: string; rowIds: string[] }>();

  for (const rowId of rowIds) {
    const row = rows[rowId];
    if (!row) continue;

    const path = cellText(cellOf(row, endpoint), endpoint, context).trim();
    const verb = cellText(cellOf(row, method), method, context).trim();

    if (path.length === 0 || verb.length === 0) continue;

    const key = `${verb.toUpperCase()} ${path.toLowerCase()}`;
    const bucket = byKey.get(key);

    if (bucket) bucket.rowIds.push(rowId);
    else byKey.set(key, { endpoint: path, method: verb.toUpperCase(), rowIds: [rowId] });
  }

  const groups: DuplicateGroup[] = [];
  const flagged = new Set<string>();

  for (const [key, bucket] of byKey) {
    if (bucket.rowIds.length < 2) continue;

    groups.push({ key, endpoint: bucket.endpoint, method: bucket.method, rowIds: bucket.rowIds });
    for (const rowId of bucket.rowIds) flagged.add(rowId);
  }

  return { groups, rowIds: flagged };
}
