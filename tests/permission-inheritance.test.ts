import { describe, expect, test } from "vitest";
import { ACCESS_SOURCE_LABELS, effectiveAccess, resolveAccess, sameSubject, subjectKey } from "@/lib/permissions";
import type { AccessRule, AccessSubject, WorkspaceMember, WorkspaceRole } from "@/types";
import { buildTestTree, ID } from "./helpers";

/**
 * Permission inheritance (SY-INH-43).
 *
 * The point of the feature is not that access resolves — it is that the UI can
 * say *why* it resolved that way, so these tests assert the source as hard as
 * they assert the role.
 */

const tree = buildTestTree();

const member = (id: string, role: WorkspaceRole): WorkspaceMember => ({
  id,
  name: id,
  email: `${id}@example.test`,
  initials: "XX",
  role,
  joinedAt: "2025-01-01T00:00:00.000Z",
});

const MEMBERS: readonly WorkspaceMember[] = [
  member("usr_admin", "admin"),
  member("usr_manager", "manager"),
  member("usr_member", "member"),
  member("usr_viewer", "viewer"),
];

const user = (userId: string): AccessSubject => ({ kind: "user", userId });

function rule(nodeId: string, subject: AccessSubject, role: WorkspaceRole): AccessRule {
  return {
    id: `acl_${nodeId}_${subjectKey(subject)}`,
    nodeId,
    subject,
    role,
    grantedAt: "2026-01-01T00:00:00.000Z",
    grantedBy: "usr_admin",
  };
}

const rulesFrom = (...entries: readonly AccessRule[]): Record<string, readonly AccessRule[]> => {
  const map: Record<string, AccessRule[]> = {};
  for (const entry of entries) (map[entry.nodeId] ??= []).push(entry);
  return map;
};

const resolve = (nodeId: string | null, rules: Record<string, readonly AccessRule[]>, subject: AccessSubject) =>
  effectiveAccess({ tree, nodeId, rules, members: MEMBERS }, subject);

describe("resolving one subject", () => {
  test("with no rules anywhere, the workspace role is what you hold", () => {
    const access = resolve(ID.payment, {}, user("usr_member"));

    expect(access.role).toBe("member");
    expect(access.source).toBe("workspace");
    expect(access.origin).toBeNull();
  });

  test("a rule on an ancestor flows down, and names where it came from", () => {
    const rules = rulesFrom(rule(ID.development, user("usr_member"), "manager"));
    const access = resolve(ID.payment, rules, user("usr_member"));

    expect(access.role).toBe("manager");
    expect(access.source).toBe("inherited");
    expect(access.origin?.nodeId).toBe(ID.development);
  });

  test("the deepest rule wins, not the strongest", () => {
    // Backend takes the project-level grant back *down*. Specificity decides,
    // which is the only reading under which an exception can ever be written.
    const rules = rulesFrom(
      rule(ID.development, user("usr_member"), "manager"),
      rule(ID.backend, user("usr_member"), "viewer"),
    );

    expect(resolve(ID.backend, rules, user("usr_member")).role).toBe("viewer");
    expect(resolve(ID.payment, rules, user("usr_member")).role).toBe("viewer");
    expect(resolve(ID.development, rules, user("usr_member")).role).toBe("manager");
  });

  test("a rule that agrees with what would arrive is explicit, not an override", () => {
    const rules = rulesFrom(rule(ID.backend, user("usr_member"), "member"));
    const access = resolve(ID.backend, rules, user("usr_member"));

    expect(access.role).toBe("member");
    expect(access.source).toBe("explicit");
    expect(access.origin?.nodeId).toBe(ID.backend);
  });

  test("a rule that replaces what would arrive is an override", () => {
    const rules = rulesFrom(
      rule(ID.development, user("usr_member"), "manager"),
      rule(ID.backend, user("usr_member"), "member"),
    );
    const access = resolve(ID.backend, rules, user("usr_member"));

    expect(access.source).toBe("override");
    expect(access.role).toBe("member");
  });

  test("a rule naming a role reaches everyone holding it", () => {
    const rules = rulesFrom(rule(ID.development, { kind: "role", role: "viewer" }, "member"));
    const access = resolve(ID.payment, rules, user("usr_viewer"));

    expect(access.role).toBe("member");
    expect(access.source).toBe("inherited");
  });

  test("a rule naming the person beats one naming their role at the same node", () => {
    const rules = rulesFrom(
      rule(ID.backend, { kind: "role", role: "member" }, "manager"),
      rule(ID.backend, user("usr_member"), "viewer"),
    );

    expect(resolve(ID.backend, rules, user("usr_member")).role).toBe("viewer");
  });

  test("the workspace itself has no node to write a rule on", () => {
    const access = resolve(null, rulesFrom(rule(ID.development, user("usr_member"), "admin")), user("usr_member"));

    expect(access.role).toBe("member");
    expect(access.source).toBe("workspace");
  });

  test("someone who is not a member of the workspace starts from nothing", () => {
    expect(resolve(ID.payment, {}, user("usr_stranger")).role).toBe("viewer");
  });
});

describe("the access list", () => {
  const rules = rulesFrom(
    rule(ID.development, user("usr_member"), "manager"),
    rule(ID.backend, user("usr_member"), "member"),
    rule(ID.backend, user("usr_viewer"), "viewer"),
    rule(ID.backend, { kind: "role", role: "manager" }, "admin"),
  );

  const entries = resolveAccess({ tree, nodeId: ID.backend, rules, members: MEMBERS });

  test("every workspace member gets a row", () => {
    for (const person of MEMBERS) {
      expect(entries.some((entry) => sameSubject(entry.subject, user(person.id))), person.id).toBe(true);
    }
  });

  test("a role-scoped rule gets a row of its own, so a group grant is never invisible", () => {
    const roleRow = entries.find((entry) => entry.subject.kind === "role");

    expect(roleRow).toBeDefined();
    expect(roleRow?.role).toBe("admin");
  });

  test("each row carries the role it would have inherited", () => {
    const overridden = entries.find((entry) => sameSubject(entry.subject, user("usr_member")));

    expect(overridden?.source).toBe("override");
    expect(overridden?.inheritedRole).toBe("manager");
    expect(overridden?.inheritedFrom?.nodeId).toBe(ID.development);
  });

  test("a row written here that changes nothing reads as explicit", () => {
    const explicit = entries.find((entry) => sameSubject(entry.subject, user("usr_viewer")));

    expect(explicit?.source).toBe("explicit");
    expect(explicit?.role).toBe("viewer");
  });

  test("rows are ordered by how much access they carry", () => {
    const roles = entries.map((entry) => entry.role);
    expect(roles[0]).toBe("admin");
    expect(roles[roles.length - 1]).toBe("viewer");
  });

  test("every source has a label the badge can render", () => {
    for (const entry of entries) {
      expect(ACCESS_SOURCE_LABELS[entry.source].length).toBeGreaterThan(0);
    }
  });
});
