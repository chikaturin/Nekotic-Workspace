import { findPathToId } from "@/lib/tree";
import { sameSubject } from "@/lib/permissions/inheritance";
import {
  childrenOf,
  isContainer,
  type AccessOrigin,
  type AccessRule,
  type AccessSubject,
  type DriveNode,
  type NodeAccessMode,
  type WorkspaceMember,
  type WorkspaceRole,
} from "@/types";

export const ACCESS_MODE_LABELS: Readonly<Record<NodeAccessMode, string>> = {
  inherit: "Inherit from parent",
  workspace: "All workspace members",
  restricted: "Restricted",
};

export const ACCESS_MODE_SUMMARIES: Readonly<Record<NodeAccessMode, string>> = {
  inherit: "Whoever can see the folder this sits in.",
  workspace: "Everyone in the workspace, whatever the parent says.",
  restricted: "Only the people listed below.",
};

export function accessModeOf(node: DriveNode): NodeAccessMode {
  return node.accessMode ?? "inherit";
}

export function isRestricted(node: DriveNode): boolean {
  return accessModeOf(node) === "restricted";
}

export type RulesByNode = Readonly<Record<string, readonly AccessRule[]>>;

export interface VisibilityInput {
  readonly tree: readonly DriveNode[];
  readonly rules: RulesByNode;
  readonly members: readonly WorkspaceMember[];
  readonly isMember: boolean;
}

function roleOf(
  subject: AccessSubject,
  members: readonly WorkspaceMember[],
): WorkspaceRole | null {
  if (subject.kind === "role") return subject.role;
  return members.find((member) => member.id === subject.userId)?.role ?? null;
}

export function hasGrantOn(
  rules: RulesByNode,
  node: DriveNode,
  subject: AccessSubject,
  members: readonly WorkspaceMember[],
): boolean {
  if (subject.kind === "user" && node.owner.id === subject.userId) return true;

  const written = rules[node.id] ?? [];
  if (written.some((rule) => sameSubject(rule.subject, subject))) return true;

  const role = roleOf(subject, members);
  if (role === null) return false;

  return written.some((rule) => rule.subject.kind === "role" && rule.subject.role === role);
}

export function grantedSubjectsOn(rules: RulesByNode, nodeId: string): readonly AccessSubject[] {
  return (rules[nodeId] ?? []).map((rule) => rule.subject);
}

function admits(
  node: DriveNode,
  inherited: boolean,
  input: VisibilityInput,
  subject: AccessSubject,
): boolean {
  switch (accessModeOf(node)) {
    case "workspace":
      return input.isMember;
    case "restricted":
      return input.isMember && hasGrantOn(input.rules, node, subject, input.members);
    default:
      return inherited;
  }
}

export interface NodeVisibility {
  readonly isVisible: boolean;
  readonly deniedAt: AccessOrigin | null;
}

const VISIBLE: NodeVisibility = { isVisible: true, deniedAt: null };

export function nodeVisibility(
  input: VisibilityInput,
  nodeId: string | null,
  subject: AccessSubject,
): NodeVisibility {
  if (!input.isMember) return { isVisible: false, deniedAt: null };
  if (nodeId === null) return VISIBLE;

  const chain = findPathToId(input.tree, nodeId);
  if (chain.length === 0) return VISIBLE;

  let allowed = true;
  for (const node of chain) {
    allowed = admits(node, allowed, input, subject);
    if (!allowed) return { isVisible: false, deniedAt: { nodeId: node.id, name: node.name } };
  }

  return VISIBLE;
}

export function canSeeNode(
  input: VisibilityInput,
  nodeId: string | null,
  subject: AccessSubject,
): boolean {
  return nodeVisibility(input, nodeId, subject).isVisible;
}

export function visibleTree(
  input: VisibilityInput,
  subject: AccessSubject,
): readonly DriveNode[] {
  if (!input.isMember) return [];

  const prune = (nodes: readonly DriveNode[], inherited: boolean): readonly DriveNode[] => {
    const kept: DriveNode[] = [];
    let changed = false;

    for (const node of nodes) {
      if (!admits(node, inherited, input, subject)) {
        changed = true;
        continue;
      }

      if (!isContainer(node)) {
        kept.push(node);
        continue;
      }

      const children = prune(node.children, true);
      if (children === node.children) {
        kept.push(node);
        continue;
      }

      changed = true;
      kept.push({ ...node, children });
    }

    return changed ? kept : nodes;
  };

  return prune(input.tree, true);
}

export function keepVisibleRefs<T>(
  items: readonly T[],
  tree: readonly DriveNode[],
  nodeIdOf: (item: T) => string,
): readonly T[] {
  const known = new Set<string>();

  const walk = (nodes: readonly DriveNode[]) => {
    for (const node of nodes) {
      known.add(node.id);
      walk(childrenOf(node));
    }
  };
  walk(tree);

  return items.filter((item) => known.has(nodeIdOf(item)));
}

export function restrictedNodesOf(tree: readonly DriveNode[]): readonly DriveNode[] {
  const found: DriveNode[] = [];

  const walk = (nodes: readonly DriveNode[]) => {
    for (const node of nodes) {
      if (isRestricted(node)) found.push(node);
      walk(childrenOf(node));
    }
  };

  walk(tree);
  return found;
}

export interface MoveImpact {
  readonly losing: readonly string[];
  readonly gaining: readonly string[];
}

const NO_IMPACT: MoveImpact = { losing: [], gaining: [] };

export function moveVisibilityImpact(
  input: VisibilityInput,
  node: DriveNode,
  targetParentId: string | null,
): MoveImpact {
  if (accessModeOf(node) !== "inherit") return NO_IMPACT;

  const losing: string[] = [];
  const gaining: string[] = [];

  for (const member of input.members) {
    const subject: AccessSubject = { kind: "user", userId: member.id };
    const before = canSeeNode(input, node.id, subject);
    const after = canSeeNode(input, targetParentId, subject);

    if (before && !after) losing.push(member.id);
    if (!before && after) gaining.push(member.id);
  }

  return { losing, gaining };
}

export function wouldLockOut(
  input: VisibilityInput,
  node: DriveNode,
  subject: AccessSubject,
): boolean {
  return !hasGrantOn(input.rules, node, subject, input.members);
}
