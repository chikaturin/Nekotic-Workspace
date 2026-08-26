import type { DriveNodeType } from "./node";

export type BreadcrumbKind = DriveNodeType | "workspace";

export interface BreadcrumbItem {
  readonly id: string;
  readonly label: string;
  /** Absolute app route for this crumb. */
  readonly href: string;
  readonly kind: BreadcrumbKind;
  /** True for the last crumb — rendered as plain text, not a link. */
  readonly isCurrent: boolean;
  /** Sibling nodes, used by the crumb dropdown to jump laterally. */
  readonly siblings: readonly { id: string; label: string; href: string }[];
}

export type BreadcrumbTrail = readonly BreadcrumbItem[];
