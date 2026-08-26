import type { CellContext } from "@/lib/cell-values";
import type { BoardColumn, CellValue, DirectoryUser, SelectOption } from "@/types";

/**
 * Everything a cell needs that is the same for the whole grid. Passed as one
 * memoised object so a row's props stay reference-stable between renders.
 */
export interface GridShared {
  readonly boardId: string;
  readonly primaryColumnId: string;
  readonly folderId: string | null;
  readonly people: readonly DirectoryUser[];
  readonly context: CellContext;
  readonly columns: readonly BoardColumn[];
  readonly rowHeight: number;
  /** Rows flagged by a board-level validation, e.g. duplicate API endpoints. */
  readonly warnedRowIds: ReadonlySet<string>;
  readonly onCreateOption: (columnId: string, label: string) => Promise<SelectOption | null>;
  readonly onCommitCell: (rowId: string, columnId: string, value: CellValue) => void;
}

/** CSS variable that carries a column's current width. */
export function widthVar(columnId: string): string {
  return `--col-w-${columnId}`;
}

export const GUTTER_WIDTH = 52;

/** Width comes from a CSS variable so a resize drag never re-renders a row. */
export function widthStyle(columnId: string, isPrimary = false): React.CSSProperties {
  return isPrimary
    ? { width: `var(${widthVar(columnId)})`, left: GUTTER_WIDTH }
    : { width: `var(${widthVar(columnId)})` };
}
