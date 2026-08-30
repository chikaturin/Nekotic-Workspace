import { findPathToId } from "@/lib/tree";
import {
  roleRank,
  type AccessOrigin,
  type AccessRule,
  type AccessSource,
  type AccessSubject,
  type DriveNode,
  type ResolvedAccess,
  type WorkspaceMember,
  type WorkspaceRole,
} from "@/types";

export const subjectKey = (subject: AccessSubject): string =>
  subject.kind === "user" ? `user:${subject.userId}` : `role:${subject.role}`;

export const sameSubject = (a: AccessSubject, b: AccessSubject): boolean =>
  subjectKey(a) === subjectKey(b);

const originOf = (node: DriveNode): AccessOrigin => ({ nodeId: node.id, name: node.name });

export interface AccessInput {
  readonly tree: readonly DriveNode[];
  readonly nodeId: string | null;
  readonly rules: Readonly<Record<string, readonly AccessRule[]>>;
  readonly members: readonly WorkspaceMember[];
}

function chainFor(tree: readonly DriveNode[], nodeId: string | null): readonly DriveNode[] {
  return nodeId === null ? [] : findPathToId(tree, nodeId);
}

interface Match {
  readonly role: WorkspaceRole;
  readonly origin: AccessOrigin;
}

function matchIn(
  chain: readonly DriveNode[],
  rules: AccessInput["rules"],
  subject: AccessSubject,
  memberRole: WorkspaceRole | null,
): Match | null {
  let found: Match | null = null;

  for (const node of chain) {
    const written = rules[node.id] ?? [];

    const direct = written.find((rule) => sameSubject(rule.subject, subject));
    const viaRole =
      subject.kind === "user" && memberRole !== null
        ? written.find(
            (rule) => rule.subject.kind === "role" && rule.subject.role === memberRole,
          )
        : undefined;

    const rule = direct ?? viaRole;
    if (rule) found = { role: rule.role, origin: originOf(node) };
  }

  return found;
}

export interface EffectiveAccess {
  readonly role: WorkspaceRole;
  readonly source: AccessSource;
  readonly origin: AccessOrigin | null;
}

export function effectiveAccess(
  { tree, nodeId, rules, members }: AccessInput,
  subject: AccessSubject,
): EffectiveAccess {
  const memberRole =
    subject.kind === "user"
      ? members.find((member) => member.id === subject.userId)?.role ?? null
      : subject.role;

  const base: WorkspaceRole = memberRole ?? "viewer";
  const chain = chainFor(tree, nodeId);
  if (chain.length === 0) return { role: base, source: "workspace", origin: null };

  const self = chain[chain.length - 1];
  const inherited = matchIn(chain.slice(0, -1), rules, subject, memberRole);
  const own = matchIn(self ? [self] : [], rules, subject, memberRole);

  if (!own) {
    return inherited
      ? { role: inherited.role, source: "inherited", origin: inherited.origin }
      : { role: base, source: "workspace", origin: null };
  }

  const wouldHave = inherited?.role ?? base;
  return {
    role: own.role,
    source: own.role === wouldHave ? "explicit" : "override",
    origin: own.origin,
  };
}

export function resolveAccess(input: AccessInput): readonly ResolvedAccess[] {
  const { tree, nodeId, rules, members } = input;
  const chain = chainFor(tree, nodeId);

  const subjects: AccessSubject[] = members.map((member) => ({
    kind: "user",
    userId: member.id,
  }));

  const seen = new Set(subjects.map(subjectKey));
  for (const node of chain) {
    for (const rule of rules[node.id] ?? []) {
      if (rule.subject.kind !== "role") continue;
      if (seen.has(subjectKey(rule.subject))) continue;
      seen.add(subjectKey(rule.subject));
      subjects.push(rule.subject);
    }
  }

  return subjects
    .map((subject) => {
      const memberRole =
        subject.kind === "user"
          ? members.find((member) => member.id === subject.userId)?.role ?? null
          : subject.role;
      const inherited = matchIn(chain.slice(0, -1), rules, subject, memberRole);
      const resolved = effectiveAccess(input, subject);

      return {
        subject,
        role: resolved.role,
        source: resolved.source,
        origin: resolved.origin,
        inheritedRole: inherited?.role ?? memberRole,
        inheritedFrom: inherited?.origin ?? null,
      } satisfies ResolvedAccess;
    })
    .sort((a, b) => roleRank(b.role) - roleRank(a.role));
}

export const ACCESS_SOURCE_LABELS: Readonly<Record<AccessSource, string>> = {
  workspace: "Workspace role",
  inherited: "Inherited",
  explicit: "Explicit",
  override: "Override",
};
