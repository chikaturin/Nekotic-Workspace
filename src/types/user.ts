import type { WorkspaceRole } from "./permission";

/** Minimal identity shape embedded in nodes, activity and comments. */
export interface UserSummary {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  /** Two-letter fallback rendered when `avatarUrl` is absent. */
  readonly initials: string;
  readonly avatarUrl?: string;
  readonly accentColor?: string;
}

/**
 * A person as the directory knows them. Members removed from the workspace stay
 * resolvable so their name still renders — flagged inactive, never dropped.
 */
export interface DirectoryUser extends UserSummary {
  readonly isActive: boolean;
}

export interface WorkspaceMember extends UserSummary {
  readonly role: WorkspaceRole;
  readonly joinedAt: string;
}
