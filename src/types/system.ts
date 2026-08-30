import type { BoardRow, CellValue, ColumnType } from "./board";
import type { Block } from "./document";
import type { DriveNode } from "./node";
import type { UserSummary } from "./user";

export type BulkActionId = "status" | "assign" | "move" | "archive" | "restore" | "delete" | "export";

export type BulkSkipReason = "archived" | "not_found";

export interface BulkSkip {
  readonly rowId: string;
  readonly displayId: string;
  readonly reason: BulkSkipReason;
}

export interface BulkResult {
  readonly requested: number;
  readonly rows: readonly BoardRow[];
  readonly applied: readonly string[];
  readonly skipped: readonly BulkSkip[];
}

export interface BulkMoveResult extends BulkResult {
  readonly targetBoardId: string;
  readonly targetNodeId: string;
  readonly droppedColumns: readonly string[];
}

export interface ImportSourceRow {
  readonly sourceRowNumber: number;
  readonly cells: readonly string[];
}

export interface ImportSource {
  readonly fileName: string;
  readonly sheetName: string | null;
  readonly headers: readonly string[];
  readonly rows: readonly ImportSourceRow[];
}

export type MappingTarget =
  | { readonly kind: "ignore" }
  | { readonly kind: "existing"; readonly columnId: string }
  | { readonly kind: "create"; readonly name: string; readonly type: ColumnType };

export interface ColumnMapping {
  readonly sourceIndex: number;
  readonly target: MappingTarget;
}

export interface MappingConflict {
  readonly sourceIndex: number;
  readonly message: string;
}

export interface ImportIssue {
  readonly rowNumber: number;
  readonly sourceHeader: string;
  readonly columnName: string;
  readonly value: string;
  readonly message: string;
}

export interface ImportDraftRow {
  readonly rowNumber: number;
  readonly cells: Readonly<Record<string, CellValue>>;
  readonly invalidColumnIds: readonly string[];
}

export interface ImportPlan {
  readonly drafts: readonly ImportDraftRow[];
  readonly issues: readonly ImportIssue[];
  readonly mappedColumnCount: number;
  readonly newColumnCount: number;
  readonly validCount: number;
  readonly invalidCount: number;
  readonly blankCount: number;
  readonly conflicts: readonly MappingConflict[];
}

export type ImportInvalidPolicy = "skip" | "blank";

export interface ImportOutcome {
  readonly created: number;
  readonly skipped: number;
  readonly issues: readonly ImportIssue[];
  readonly rowIds: readonly string[];
  readonly removedColumns?: readonly string[];
}

export type ImportStep = "upload" | "mapping" | "validation" | "result";

export type ExportFormat = "xlsx" | "csv" | "pdf";

export type ExportScope = "board" | "view" | "selection";

export interface ExportOutcome {
  readonly fileName: string;
  readonly rowCount: number;
  readonly columnCount: number;
  readonly omittedColumns: readonly string[];
}

export interface TrashEntry {
  readonly id: string;
  readonly node: DriveNode;
  readonly deletedAt: string;
  readonly deletedBy: UserSummary;
  readonly originalAncestorIds: readonly string[];
  readonly originalPath: string;
}

export interface RestoreOutcome {
  readonly node: DriveNode;
  readonly parentId: string | null;
  readonly isRelocated: boolean;
  readonly location: string;
}

export interface DocumentVersion {
  readonly id: string;
  readonly version: number;
  readonly title: string;
  readonly blocks: readonly Block[];
  readonly createdAt: string;
  readonly author: UserSummary;
  readonly summary: string;
}

export interface VersionEntry {
  readonly id: string;
  readonly version: number;
  readonly createdAt: string;
  readonly author: UserSummary;
  readonly summary: string;
  readonly lines: readonly string[];
  readonly hasSnapshot: boolean;
}

export type DiffKind = "same" | "added" | "removed";

export interface DiffLine {
  readonly kind: DiffKind;
  readonly text: string;
}

export interface DiffSummary {
  readonly added: number;
  readonly removed: number;
}
