import type { WorkspaceRole } from "./permission";

export interface UserSummary {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly initials: string;
  readonly avatarUrl?: string;
  readonly accentColor?: string;
}

export interface DirectoryUser extends UserSummary {
  readonly isActive: boolean;
}

export interface WorkspaceMember extends UserSummary {
  readonly role: WorkspaceRole;
  readonly joinedAt: string;
}
