import type { SmartView } from "@/types";

export const APP_NAME = "NexDrop";
export const APP_TAGLINE = "All-in-One Workspace";

/**
 * Frozen clock for the mock dataset. Relative timestamps are computed against
 * this value so server-rendered and client-rendered markup always agree.
 */
export const MOCK_NOW = "2026-08-26T09:30:00.000Z";

export const DRIVE_ROOT_PATH = "/drive";
export const FILES_ROOT_PATH = "/files";

/** Sidebar geometry, shared by the shell grid and the collapse animation. */
export const SIDEBAR_WIDTH_EXPANDED = 276;
export const SIDEBAR_WIDTH_COLLAPSED = 64;
export const HEADER_HEIGHT = 56;

/** Depth at which the breadcrumb collapses middle crumbs into a menu. */
export const BREADCRUMB_VISIBLE_LIMIT = 4;

export const SEARCH_RESULT_LIMIT = 24;

/** Tree rendering engine: a dependency-free recursive tree, or react-arborist. */
export const TREE_ENGINE: "recursive" | "arborist" = "recursive";

export const TREE_INDENT = 14;
export const TREE_ROW_HEIGHT = 30;

export const SMART_VIEWS: readonly SmartView[] = [
  {
    id: "my-work",
    label: "My Work",
    href: "/my-work",
    description: "Everything assigned to you across projects",
  },
  {
    id: "favorites",
    label: "Favorites",
    href: "/favorites",
    description: "Folders, boards and files you starred",
  },
  {
    id: "recent",
    label: "Recent",
    href: "/recent",
    description: "Items you touched in the last 7 days",
  },
  {
    id: "notifications",
    label: "Notifications",
    href: "/notifications",
    description: "Mentions, requests and system alerts",
  },
  {
    id: "archive",
    label: "Archive",
    description: "Pages archived out of the active workspace",
    href: "/archive",
  },
  {
    id: "trash",
    label: "Trash",
    href: "/trash",
    description: "Deleted items, purged after 30 days",
  },
] as const;

/** Custom MIME type carrying an internal node id during a drag. */
export const DND_NODE_MIME = "application/x-nexdrop-node";
