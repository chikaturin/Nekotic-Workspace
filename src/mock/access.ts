import { flattenTree } from "@/lib/tree";
import { TREES_BY_WORKSPACE } from "@/mock/tree";
import { CURRENT_USER } from "@/mock/users";
import { DEFAULT_WORKSPACE_ID } from "@/mock/workspaces";
import type { AccessRule, AccessSubject, DriveNode, WorkspaceRole } from "@/types";

/**
 * Seed access rules (SY-INH-43).
 *
 * Written against node *names* rather than ids: the tree mints its ids from
 * the name path, so a hard-coded id would rot the moment a folder is renamed
 * in the fixture. A rule whose node is missing is dropped rather than guessed.
 */

const SEEDED_AT = "2026-08-12T09:00:00.000Z";

interface RuleSpec {
  readonly workspaceId: string;
  readonly nodeName: string;
  readonly subject: AccessSubject;
  readonly role: WorkspaceRole;
}

const SPECS: readonly RuleSpec[] = [
  // Duc runs the Development project, one step above his workspace role…
  {
    workspaceId: DEFAULT_WORKSPACE_ID,
    nodeName: "Development",
    subject: { kind: "user", userId: "usr_duc" },
    role: "manager",
  },
  // …but not inside Backend, where that grant is taken back down again.
  {
    workspaceId: DEFAULT_WORKSPACE_ID,
    nodeName: "Backend",
    subject: { kind: "user", userId: "usr_duc" },
    role: "member",
  },
  // Written here in its own right, and identical to what would have arrived.
  {
    workspaceId: DEFAULT_WORKSPACE_ID,
    nodeName: "Backend",
    subject: { kind: "user", userId: "usr_lan" },
    role: "member",
  },
  // A grant that names a role rather than a person.
  {
    workspaceId: DEFAULT_WORKSPACE_ID,
    nodeName: "Marketing",
    subject: { kind: "role", role: "viewer" },
    role: "member",
  },
];

function nodeIdByName(tree: readonly DriveNode[], name: string): string | null {
  return flattenTree(tree).find((node) => node.name === name)?.id ?? null;
}

export function seedAccessRules(): Readonly<
  Record<string, Readonly<Record<string, readonly AccessRule[]>>>
> {
  const byWorkspace: Record<string, Record<string, AccessRule[]>> = {};

  for (const [index, spec] of SPECS.entries()) {
    const tree = TREES_BY_WORKSPACE[spec.workspaceId];
    if (!tree) continue;

    const nodeId = nodeIdByName(tree, spec.nodeName);
    if (!nodeId) continue;

    const forWorkspace = (byWorkspace[spec.workspaceId] ??= {});
    const forNode = (forWorkspace[nodeId] ??= []);

    forNode.push({
      id: `acl_seed_${index}`,
      nodeId,
      subject: spec.subject,
      role: spec.role,
      grantedAt: SEEDED_AT,
      grantedBy: CURRENT_USER.id,
    });
  }

  return byWorkspace;
}
