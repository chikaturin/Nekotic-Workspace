import type { SmartView } from "@/types";

export const APP_NAME = "Nekotic Workspace";
export const APP_TAGLINE = "All-in-One Workspace";

export const MOCK_NOW = "2026-08-26T09:30:00.000Z";

export const DRIVE_ROOT_PATH = "/drive";
export const FILES_ROOT_PATH = "/files";

export const SIDEBAR_WIDTH_EXPANDED = 276;
export const SIDEBAR_WIDTH_COLLAPSED = 64;
export const HEADER_HEIGHT = 56;

export const SIDEBAR_COLLAPSE_BREAKPOINT = 1024;

export const BREADCRUMB_VISIBLE_LIMIT = 4;

export const SEARCH_GROUP_LIMIT = 5;

export const SEARCH_DEBOUNCE_MS = 180;

export const RECENT_LIMIT = 10;

export const MY_WORK_WIDGET_LIMIT = 6;

export const TRASH_RETENTION_DAYS = 30;

export const IMPORT_PREVIEW_ROWS = 8;

export const IMPORT_MAX_ROWS = 5_000;

export const IMPORT_ISSUE_LIMIT = 50;

export const EXPORT_PDF_LINE_WIDTH = 92;

export const AUDIT_PAGE_SIZE = 40;

export const DASHBOARD_WEEK_DAYS = 7;

export const VERSION_HISTORY_LIMIT = 20;

export const REALTIME_ENDPOINT: string | null = null;

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

export const DND_NODE_MIME = "application/x-nekotic-node";
export const IMPORT_SELECT_OPTION_LIMIT = 40;
