import type {
  Board,
  BoardColumn,
  BoardNode,
  BoardRow,
  CellEdit,
  CellValue,
  ColumnMapping,
  ConflictNotice,
  ImportInvalidPolicy,
  SavedView,
  } from "@/types";

export interface CreateRowInput {
  readonly boardId: string;
  readonly afterRowId?: string | null;
  readonly cells?: Readonly<Record<string, import("@/types").CellValue>>;
  readonly parentRowId?: string | null;
}

export interface UpdateCellsInput {
  readonly boardId: string;
  readonly edits: readonly CellEdit[];
  readonly baseRevisions?: Readonly<Record<string, number>>;
}

export interface UpdateCellsResult {
  readonly rows: readonly BoardRow[];
  readonly conflicts: readonly ConflictNotice[];
}

export interface ConvertColumnResult {
  readonly column: BoardColumn;
  readonly rows: readonly BoardRow[];
  readonly preserved: number;
}

export interface CreateViewInput {
  readonly name: string;
  readonly type: SavedView["type"];
  readonly from?: SavedView;
}

export interface BulkTargets {
  readonly boardId: string;
  readonly rowIds: readonly string[];
}

export interface BulkUpdateInput extends BulkTargets {
  readonly values: Readonly<Record<string, CellValue>>;
}

export interface BulkArchiveInput extends BulkTargets {
  readonly isArchived: boolean;
}

export interface BulkMoveInput extends BulkTargets {
  readonly targetNodeId: string;
}

export interface ImportRowsInput {
  readonly boardId: string;
  readonly file: File;
  readonly mappings: readonly ColumnMapping[];
  readonly invalidPolicy: ImportInvalidPolicy;
  readonly removeColumnIds?: readonly string[];
  readonly hasHeaderRow?: boolean;
}

export interface ImportRowsResult {
  readonly created: number;
  readonly skipped: number;
  readonly issueCount: number;
  readonly rowIds: readonly string[];
  readonly removedColumns?: readonly string[];
}

export interface BoardDescriptor {
  readonly boardId: string;
  readonly nodeId: string;
  readonly name: string;
  readonly rowIdPrefix: string;
}

export interface BoardScanEntry {
  readonly node: BoardNode;
  readonly board: Board;
  readonly rows: readonly BoardRow[];
}

export interface ScanOptions {
  readonly allow?: (node: BoardNode) => boolean;
}

export interface RelationTarget {
  readonly rowId: string;
  readonly displayId: string;
  readonly title: string;
  readonly boardId: string;
  readonly boardName: string;
}

export interface Backlink {
  readonly boardId: string;
  readonly boardNodeId: string;
  readonly boardName: string;
  readonly columnName: string;
  readonly rowId: string;
  readonly displayId: string;
  readonly title: string;
}
