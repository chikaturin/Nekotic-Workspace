import type { SmartView } from "@/types";

export const APP_NAME = "Nekotic Workspace";
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

/**
 * Below this the 276px rail leaves the content pane unusable, so it collapses
 * to its icon width on its own and expands again when there is room.
 */
export const SIDEBAR_COLLAPSE_BREAKPOINT = 1024;

/** Depth at which the breadcrumb collapses middle crumbs into a menu. */
export const BREADCRUMB_VISIBLE_LIMIT = 4;

/** Results kept per group in global search, before the "in Drive" fallback. */
export const SEARCH_GROUP_LIMIT = 5;

/** Debounce before a keystroke reaches the search services. */
export const SEARCH_DEBOUNCE_MS = 180;

/** Recent (CO-REC-33) keeps the last N places visited, least-recently-used out. */
export const RECENT_LIMIT = 10;

/** Rows shown per My Work widget before it links through to the board. */
export const MY_WORK_WIDGET_LIMIT = 6;

/** How long Trash holds a deleted item before the backend sweeps it (SY-TRH-38). */
export const TRASH_RETENTION_DAYS = 30;

/** Source rows shown in the import preview and mapping steps. */
export const IMPORT_PREVIEW_ROWS = 8;

/** Ceiling on one import, so a mis-picked file cannot flood a board. */
export const IMPORT_MAX_ROWS = 5_000;

/** Row errors listed before the validation step collapses the rest to a count. */
export const IMPORT_ISSUE_LIMIT = 50;

/** Characters per line in an exported PDF, at the writer's fixed page width. */
export const EXPORT_PDF_LINE_WIDTH = 92;

/** Audit rows fetched per page (SY-AUD-41). The log is read, never edited. */
export const AUDIT_PAGE_SIZE = 40;

/** Days ahead the dashboard's "This week" deadline bucket looks (SY-DSH-44). */
export const DASHBOARD_WEEK_DAYS = 7;

/** Versions kept per document before the oldest snapshot is dropped. */
export const VERSION_HISTORY_LIMIT = 20;

/**
 * Realtime endpoint. Null while the backend exposes no socket, which is what
 * keeps `lib/realtime/transport` on the in-process bus.
 */
export const REALTIME_ENDPOINT: string | null = null;

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
