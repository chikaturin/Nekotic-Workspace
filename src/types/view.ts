import type { DriveNode } from "./node";

export type ViewMode = "grid" | "list";

export type SortKey = "name" | "updatedAt" | "size" | "type";

export type SortDirection = "asc" | "desc";

export interface SortState {
  readonly key: SortKey;
  readonly direction: SortDirection;
}

/** Non-drive destinations reachable from the sidebar. */
export type SmartViewId =
  | "my-work"
  | "favorites"
  | "recent"
  | "notifications"
  | "archive"
  | "trash";

export interface SmartView {
  readonly id: SmartViewId;
  readonly label: string;
  readonly href: string;
  readonly description: string;
}

/** Result of resolving a URL path against the workspace tree. */
export interface DriveLocation {
  /** Node addressed by the URL, or null when at the workspace root. */
  readonly node: DriveNode | null;
  /** Ancestors from workspace root down to (and excluding) `node`. */
  readonly ancestors: readonly DriveNode[];
  /** Items rendered in the working area. */
  readonly children: readonly DriveNode[];
  /** True when the URL points at a segment that does not exist. */
  readonly isNotFound: boolean;
}

export interface SearchHit {
  readonly node: DriveNode;
  /** Human-readable ancestor path, e.g. `Development / Backend`. */
  readonly path: string;
  readonly href: string;
}
