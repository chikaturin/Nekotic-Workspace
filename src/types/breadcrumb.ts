import type { DriveNodeType } from "./node";

export type BreadcrumbKind = DriveNodeType | "workspace";

export interface BreadcrumbItem {
  readonly id: string;
  readonly label: string;
  readonly href: string;
  readonly kind: BreadcrumbKind;
  readonly isCurrent: boolean;
  readonly siblings: readonly { id: string; label: string; href: string }[];
}

export type BreadcrumbTrail = readonly BreadcrumbItem[];
