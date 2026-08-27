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

/**
 * Resource access: *may this person see this node at all* (SY-FAC).
 *
 * This is a different question from the one `evaluate.ts` answers. That one
 * decides what somebody may **do** once they are looking at something; this one
 * decides whether they get to look. Keeping them apart is the whole point:
 *
 *   - a Viewer who is granted a restricted folder **sees it** and edits nothing,
 *   - a Manager who is not granted it **does not see it**, whatever their role.
 *
 * Merging the two would make "high enough role" a way into a folder somebody
 * deliberately shut, which is exactly the property a restricted folder exists
 * to have.
 *
 * Nothing is copied down the tree. Access is *resolved* by walking from the
 * root to the node, so restricting a folder with ten thousand descendants
 * writes one field, and a child's own mode is the only thing that can change
 * what it inherited.
 */

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

/** Absent means inherit — which is what almost every node is. */
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
  /** False for someone who is not in the workspace at all — they see nothing. */
  readonly isMember: boolean;
}

/** The workspace role a subject holds, so a role-scoped grant can match it. */
function roleOf(
  subject: AccessSubject,
  members: readonly WorkspaceMember[],
): WorkspaceRole | null {
  if (subject.kind === "role") return subject.role;
  return members.find((member) => member.id === subject.userId)?.role ?? null;
}

/**
 * Whether a grant written *on this node* admits the subject.
 *
 * A rule naming the person counts, and so does one naming the workspace role
 * they hold — the same two ways `inheritance.ts` matches, so one access list
 * drives both what you can see and what you can do with it.
 *
 * The node's owner is always admitted. Somebody has to be able to get back
 * into a folder they shut, and "whoever made it" is a rule a person can hold
 * in their head — which an emergency override buried in an admin console is
 * not.
 */
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

/** Everyone explicitly granted on one node, owner aside. */
export function grantedSubjectsOn(rules: RulesByNode, nodeId: string): readonly AccessSubject[] {
  return (rules[nodeId] ?? []).map((rule) => rule.subject);
}

/**
 * One step of the walk: what this node does to the access flowing into it.
 *
 * `inherit` passes it through, `workspace` opens it to every member, and
 * `restricted` throws it away and asks only about the grants written here.
 *
 * Access gates the *path*, not the node: this is only reached for a node whose
 * ancestors already admitted the subject. So all-members widens from the folder
 * it is set on downwards and cannot punch back up through a restriction above
 * it — a tree cannot render a child whose parent is missing, and showing one
 * anyway would leak the name of the folder it sits in.
 */
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
  /**
   * The node that refused, when one did. It is named for the *caller's* own
   * bookkeeping — never rendered to the person who was refused, who is not
   * entitled to learn that a folder called Finance exists.
   */
  readonly deniedAt: AccessOrigin | null;
}

const VISIBLE: NodeVisibility = { isVisible: true, deniedAt: null };

/**
 * Whether one subject may see one node, and which ancestor stopped them.
 *
 * Walks root → node, so the answer accounts for every mode on the way down:
 * a restricted folder gates its whole subtree, and a child that declares
 * `workspace` opens itself back up.
 */
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

/**
 * The tree as this subject is allowed to know it.
 *
 * Pruned once, from the root down, carrying the decision with it — so the cost
 * is one pass over the tree rather than a chain walk per node. A node that is
 * refused takes its whole subtree with it, which is what stops a board inside a
 * restricted folder from surfacing in search, favourites or a relation picker
 * just because the board itself carries no restriction of its own.
 *
 * Everything downstream reads *this* tree. That is the centralisation: no
 * surface asks "may I show this", because what it was handed is already the
 * answer.
 */
export function visibleTree(
  input: VisibilityInput,
  subject: AccessSubject,
): readonly DriveNode[] {
  if (!input.isMember) return [];

  /**
   * Returns the array it was given when it removed nothing.
   *
   * Most of the time a tree has no restricted folder in it at all, and rebuilding
   * every node would hand every subscriber a new object on every read — which is
   * a re-render of the entire drive for no change. Preserving identity keeps the
   * common case free.
   */
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

/**
 * Keep only the items whose node is still in the tree the caller was handed.
 *
 * Recent, Favourites and the inbox all hold a *denormalised label* — the name
 * of the thing, copied at the time it was visited. Left alone, an entry
 * outlives the access that produced it and the stale label becomes the leak:
 * the resource is gone, and its name is still on screen. Resolving against the
 * visible tree drops the whole entry rather than rendering a tombstone with a
 * private name written on it.
 */
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

/**
 * Every restricted node in the workspace, whether or not the caller can see it.
 *
 * This is the admin recovery path, and the only place that deliberately looks
 * past resource access. A workspace admin can already grant themselves any
 * folder, so withholding the *name* of one would buy nothing but a folder
 * nobody can ever unlock. It is gated on `workspace.permission.manage`, it
 * exposes names and paths and no content, and every grant it writes is audited.
 */
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

/**
 * Who stops being able to see a node once it is moved (SY-FAC).
 *
 * Moving something is a permission change wearing the costume of a drag: a
 * board dropped into a restricted folder becomes invisible to everybody the
 * folder is not shared with, and nothing about the board itself changed. The
 * only honest thing to do is say so before it happens.
 *
 * A node with a mode of its own carries that mode with it, so nothing shifts —
 * this only applies to the inheriting majority.
 */
export interface MoveImpact {
  /** Members who can see it now and would not afterwards. */
  readonly losing: readonly string[];
  /** Members who cannot see it now and would afterwards. */
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

/**
 * Whether switching a node to `restricted` would shut the actor out of it.
 *
 * Called before the write, because a folder you cannot see is a folder you
 * cannot re-open — the dialog grants the actor first rather than discovering
 * this afterwards.
 */
export function wouldLockOut(
  input: VisibilityInput,
  node: DriveNode,
  subject: AccessSubject,
): boolean {
  return !hasGrantOn(input.rules, node, subject, input.members);
}
