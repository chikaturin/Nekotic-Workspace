import { flattenTree } from "@/lib/tree";
import { TREES_BY_WORKSPACE } from "@/mock/tree";
import { CURRENT_USER } from "@/mock/users";
import { DEFAULT_WORKSPACE_ID } from "@/mock/workspaces";
import type { AccessRule, AccessSubject, DriveNode, WorkspaceRole } from "@/types";

const SEEDED_AT = "2026-08-12T09:00:00.000Z";

interface RuleSpec {
  readonly workspaceId: string;
  readonly nodeName: string;
  readonly subject: AccessSubject;
  readonly role: WorkspaceRole;
}

const SPECS: readonly RuleSpec[] = [
  {
    workspaceId: DEFAULT_WORKSPACE_ID,
    nodeName: "Development",
    subject: { kind: "user", userId: "usr_duc" },
    role: "manager",
  },
  {
    workspaceId: DEFAULT_WORKSPACE_ID,
    nodeName: "Backend",
    subject: { kind: "user", userId: "usr_duc" },
    role: "member",
  },
  {
    workspaceId: DEFAULT_WORKSPACE_ID,
    nodeName: "Backend",
    subject: { kind: "user", userId: "usr_lan" },
    role: "member",
  },
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
