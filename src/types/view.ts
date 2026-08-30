import type { DriveNode } from "./node";

export type ViewMode = "grid" | "list";

export type SortKey = "name" | "updatedAt" | "size" | "type";

export type SortDirection = "asc" | "desc";

export interface SortState {
  readonly key: SortKey;
  readonly direction: SortDirection;
}

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

export interface DriveLocation {
  readonly node: DriveNode | null;
  readonly ancestors: readonly DriveNode[];
  readonly children: readonly DriveNode[];
  readonly isNotFound: boolean;
}

export interface SearchHit {
  readonly node: DriveNode;
  readonly path: string;
  readonly href: string;
}
