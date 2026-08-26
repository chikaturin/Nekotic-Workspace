import type { BoardRow, CellValue } from "./board";
import type { Block } from "./document";
import type { DriveNode } from "./node";
import type { UserSummary } from "./user";

/**
 * The System Engine vocabulary: bulk writes, import, export, archive, trash and
 * version history. These seven features all operate on records or nodes that
 * already exist, so nothing here introduces a second copy of the data — every
 * shape is either a *request*, a *plan* or a *report*.
 */

/* --------------------------------------------------------- bulk (SY-BLK-34) */

export type BulkActionId = "status" | "assign" | "move" | "archive" | "restore" | "delete" | "export";

/**
 * Why a selected record was left untouched.
 *
 * `archived` is the rule the client can prove: an archived record is read-only,
 * so a bulk write skips it. Per-row ACLs live on the backend; when they land
 * they report through this same channel rather than a second one.
 */
export type BulkSkipReason = "archived" | "not_found";

export interface BulkSkip {
  readonly rowId: string;
  readonly displayId: string;
  readonly reason: BulkSkipReason;
}

/**
 * The answer to one bulk call. `applied` and `skipped` together account for
 * every id the caller sent, which is what makes partial success reportable
 * instead of silent.
 */
export interface BulkResult {
  readonly requested: number;
  /** Authoritative records for the ids that changed. */
  readonly rows: readonly BoardRow[];
  readonly applied: readonly string[];
  readonly skipped: readonly BulkSkip[];
}

export interface BulkMoveResult extends BulkResult {
  readonly targetBoardId: string;
  readonly targetNodeId: string;
  /** Columns of the source board that the target has no counterpart for. */
  readonly droppedColumns: readonly string[];
}

/* ------------------------------------------------------- import (SY-IMP-35) */

/** A parsed spreadsheet, header row already split off from the data. */
export interface ImportSource {
  readonly fileName: string;
  readonly sheetName: string | null;
  readonly headers: readonly string[];
  readonly rows: readonly (readonly string[])[];
}

/** One source column pointed at a board column, or explicitly ignored. */
export interface ColumnMapping {
  readonly sourceIndex: number;
  readonly columnId: string | null;
}

export interface ImportIssue {
  /** 1-based position in the data rows — what the preview table numbers. */
  readonly rowNumber: number;
  readonly sourceHeader: string;
  readonly columnName: string;
  readonly value: string;
  readonly message: string;
}

export interface ImportDraftRow {
  readonly rowNumber: number;
  readonly cells: Readonly<Record<string, CellValue>>;
  /** Columns whose source value the type could not parse. */
  readonly invalidColumnIds: readonly string[];
}

/** What an import *would* write, computed before anything is sent. */
export interface ImportPlan {
  readonly drafts: readonly ImportDraftRow[];
  readonly issues: readonly ImportIssue[];
  readonly mappedColumnCount: number;
  readonly validCount: number;
  readonly invalidCount: number;
  /** Source rows with nothing in any mapped column — never imported. */
  readonly blankCount: number;
}

/** What to do with rows that hold a value the column cannot parse. */
export type ImportInvalidPolicy = "skip" | "blank";

export interface ImportOutcome {
  readonly created: number;
  readonly skipped: number;
  readonly issues: readonly ImportIssue[];
  readonly rowIds: readonly string[];
}

export type ImportStep = "upload" | "mapping" | "validation" | "result";

/* ------------------------------------------------------- export (SY-EXP-36) */

export type ExportFormat = "xlsx" | "csv" | "pdf";

/** Entire board · the current view (filters, sort, search) · the selection. */
export type ExportScope = "board" | "view" | "selection";

export interface ExportOutcome {
  readonly fileName: string;
  readonly rowCount: number;
  readonly columnCount: number;
  /** Columns withheld because the viewer may not read them. */
  readonly omittedColumns: readonly string[];
}

/* -------------------------------------------------------- trash (SY-TRH-38) */

/**
 * A soft-deleted node.
 *
 * The subtree is detached from the tree and held here, so permanently deleting
 * a folder cannot take an already-deleted child with it — which is exactly the
 * case where restoring has to find a new home.
 */
export interface TrashEntry {
  readonly id: string;
  readonly node: DriveNode;
  readonly deletedAt: string;
  readonly deletedBy: UserSummary;
  /** Ancestors at the moment of deletion, root first. */
  readonly originalAncestorIds: readonly string[];
  /** `Development / Backend` — resolved at deletion, so it survives a purge. */
  readonly originalPath: string;
}

export interface RestoreOutcome {
  readonly node: DriveNode;
  readonly parentId: string | null;
  /** True when the original parent is gone and the node landed elsewhere. */
  readonly isRelocated: boolean;
  readonly location: string;
}

/* ---------------------------------------------------- versions (SY-VER-39) */

export interface DocumentVersion {
  readonly id: string;
  readonly version: number;
  readonly title: string;
  readonly blocks: readonly Block[];
  readonly createdAt: string;
  readonly author: UserSummary;
  /** `+3 −1 lines` — enough to scan the history without opening a diff. */
  readonly summary: string;
}

/**
 * One version as the shared history UI reads it, whatever produced it. The
 * snapshot is plain text: a config file's contents, a page's blocks rendered to
 * lines. Secret documents deliberately have no snapshot — see `hasSnapshot`.
 */
export interface VersionEntry {
  readonly id: string;
  readonly version: number;
  readonly createdAt: string;
  readonly author: UserSummary;
  readonly summary: string;
  readonly lines: readonly string[];
  /**
   * False when the version records *that* something changed without holding
   * the value — a rotated secret. Such an entry can be read but never diffed
   * or restored, because the client never holds the plaintext to restore.
   */
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
