import {
  NO_CAPABILITIES,
  type CapabilitySet,
  type DriveNode,
  type UserSummary,
  type WorkspaceDocument,
  type WorkspaceRole,
} from "@/types";

const ROLE_CAPABILITIES: Readonly<Record<WorkspaceRole, CapabilitySet>> = {
  owner: { view: true, edit: true, upload: true, delete: true, share: true, manage: true },
  admin: { view: true, edit: true, upload: true, delete: true, share: true, manage: true },
  member: { view: true, edit: true, upload: true, delete: true, share: true, manage: false },
  guest: { view: true, edit: false, upload: false, delete: false, share: false, manage: false },
};

interface CapabilityInput {
  readonly role: WorkspaceRole;
  readonly user: UserSummary;
  /** Node being acted on; omit for workspace-level checks. */
  readonly node?: DriveNode | null;
}

/**
 * Single source of truth for what a user may do. UI components read the
 * resulting flags — they never re-derive rules from roles or ownership.
 */
export function capabilitiesFor({ role, user, node }: CapabilityInput): CapabilitySet {
  const base = ROLE_CAPABILITIES[role];
  if (!node) return base;

  // A restricted vault is private to the person who owns it, whatever the
  // workspace role of the viewer is.
  if (node.isRestricted && node.owner.id !== user.id) return NO_CAPABILITIES;

  const isOwnerOfNode = node.owner.id === user.id;
  const canDelete = base.manage || isOwnerOfNode ? base.delete : false;

  if (node.isTrashed) {
    return { ...base, edit: false, upload: false, share: false, delete: canDelete };
  }

  return { ...base, delete: canDelete };
}

/** Locking and archiving narrow an existing capability set — never widen it. */
export function documentCapabilities(
  base: CapabilitySet,
  document: Pick<WorkspaceDocument, "isLocked" | "isArchived">,
): CapabilitySet {
  if (!document.isLocked && !document.isArchived) return base;
  return { ...base, edit: false, upload: false };
}

/** Who may take the lock off again: managers and the document owner. */
export function canToggleLock(
  base: CapabilitySet,
  document: Pick<WorkspaceDocument, "owner">,
  user: UserSummary,
): boolean {
  return base.manage || document.owner.id === user.id;
}

/** Reason shown on the permission-denied screen. */
export function deniedReason(node: DriveNode | null): string {
  if (node?.isRestricted) {
    return `“${node.name}” is restricted to a group you are not part of. Ask a workspace admin for access.`;
  }
  return "You do not have permission to view this content.";
}
