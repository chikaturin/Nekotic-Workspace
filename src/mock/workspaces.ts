import { CURRENT_USER, MEMBERS } from "@/mock/users";
import type { Workspace } from "@/types";

const GIGABYTE = 1024 ** 3;

export const WORKSPACES: readonly Workspace[] = [
  {
    id: "ws_nexdrop",
    name: "Nekotic Workspace",
    slug: "nexdrop",
    plan: "team",
    badge: "ND",
    color: "var(--accent)",
    members: MEMBERS,
    storage: { usedBytes: 268 * GIGABYTE, totalBytes: 512 * GIGABYTE },
  },
  {
    id: "ws_aurora",
    name: "Aurora Labs",
    slug: "aurora-labs",
    plan: "free",
    badge: "AL",
    color: "var(--kind-image)",
    members: MEMBERS.slice(0, 3),
    storage: { usedBytes: 9 * GIGABYTE, totalBytes: 15 * GIGABYTE },
  },
  {
    // Deliberately empty, so the dashboard's first-run state (SY-DSH-44) is a
    // place you can actually stand rather than a branch nobody ever reaches.
    id: "ws_atlas",
    name: "Atlas",
    slug: "atlas",
    plan: "free",
    badge: "AT",
    color: "var(--kind-spreadsheet)",
    members: [
      { ...CURRENT_USER, role: "admin", joinedAt: "2026-08-24T08:00:00.000Z" },
    ],
    storage: { usedBytes: 0, totalBytes: 15 * GIGABYTE },
  },
] as const;

export const DEFAULT_WORKSPACE_ID = "ws_nexdrop";
