import type { DirectoryUser, UserSummary, WorkspaceMember, WorkspaceRole } from "@/types";

export const CURRENT_USER: UserSummary = {
  id: "usr_khanh",
  name: "Khanh Luu",
  email: "khanhluu95@gmail.com",
  initials: "KL",
  accentColor: "var(--accent)",
};

export const TEAM: readonly UserSummary[] = [
  CURRENT_USER,
  { id: "usr_mai", name: "Mai Tran", email: "mai@nexdrop.io", initials: "MT", accentColor: "var(--kind-image)" },
  { id: "usr_duc", name: "Duc Pham", email: "duc@nexdrop.io", initials: "DP", accentColor: "var(--kind-board)" },
  { id: "usr_lan", name: "Lan Nguyen", email: "lan@nexdrop.io", initials: "LN", accentColor: "var(--kind-spreadsheet)" },
  { id: "usr_hai", name: "Hai Vo", email: "hai@nexdrop.io", initials: "HV", accentColor: "var(--kind-video)" },
] as const;

const ROLES: readonly WorkspaceRole[] = ["admin", "manager", "member", "member", "viewer"];

export const MEMBERS: readonly WorkspaceMember[] = TEAM.map((user, index) => ({
  ...user,
  role: ROLES[index] ?? "viewer",
  joinedAt: `2025-0${index + 2}-14T08:00:00.000Z`,
}));

export function memberAt(index: number): UserSummary {
  return TEAM[index % TEAM.length] ?? CURRENT_USER;
}

export const DIRECTORY: readonly DirectoryUser[] = [
  ...TEAM.map((user) => ({ ...user, isActive: true })),
  {
    id: "usr_former_thanh",
    name: "Thanh Bui",
    email: "thanh@nexdrop.io",
    initials: "TB",
    accentColor: "var(--kind-archive)",
    isActive: false,
  },
  {
    id: "usr_former_quyen",
    name: "Quyen Do",
    email: "quyen@nexdrop.io",
    initials: "QD",
    accentColor: "var(--kind-audio)",
    isActive: false,
  },
];

export function directoryAt(index: number): DirectoryUser {
  return DIRECTORY[index % DIRECTORY.length] ?? DIRECTORY[0]!;
}
