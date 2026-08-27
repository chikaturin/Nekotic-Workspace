import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import {
  PERMISSIONS,
  PERMISSION_BY_KEY,
  ROLE_PERMISSIONS,
  can,
  frozenResolver,
  minimumRoleFor,
  moduleOf,
  permissionLabel,
  permissionsByModule,
  requirementFor,
  resolverFor,
  roleHas,
} from "@/lib/permissions";
import { findNodeById } from "@/lib/tree";
import { CURRENT_USER, memberAt } from "@/mock/users";
import {
  PERMISSION_KEYS,
  WORKSPACE_ROLES,
  type DriveNode,
  type PermissionKey,
} from "@/types";
import { buildTestTree, ID } from "./helpers";

const tree = buildTestTree();
const node = (id: string): DriveNode => {
  const found = findNodeById(tree, id);
  if (!found) throw new Error(`fixture missing: ${id}`);
  return found;
};

describe("the catalogue", () => {
  test("every key has a definition, a module and a label", () => {
    expect(PERMISSIONS).toHaveLength(PERMISSION_KEYS.length);

    for (const key of PERMISSION_KEYS) {
      const definition = PERMISSION_BY_KEY.get(key);
      expect(definition, key).toBeDefined();
      expect(definition?.label.length).toBeGreaterThan(0);
      expect(definition?.summary.length).toBeGreaterThan(0);
    }
  });

  test("a key's module is its own first segment, never a second declaration", () => {
    for (const definition of PERMISSIONS) {
      expect(definition.key.startsWith(`${definition.module}.`)).toBe(true);
      expect(moduleOf(definition.key)).toBe(definition.module);
    }
  });

  test("grouping the catalogue loses nothing", () => {
    const grouped = permissionsByModule().flatMap((group) => group.permissions);
    expect(grouped).toHaveLength(PERMISSION_KEYS.length);
    expect(new Set(grouped.map((entry) => entry.key)).size).toBe(PERMISSION_KEYS.length);
  });

  test("labels are human, never the raw key", () => {
    expect(permissionLabel("board.column.create")).toBe("Create columns");
    expect(requirementFor("secret.reveal")).toContain("Admin");
  });
});

describe("the role matrix", () => {
  test("each role holds everything the role below it holds", () => {
    for (let index = 1; index < WORKSPACE_ROLES.length; index += 1) {
      const lower = WORKSPACE_ROLES[index - 1]!;
      const higher = WORKSPACE_ROLES[index]!;

      for (const key of ROLE_PERMISSIONS[lower]) {
        expect(roleHas(higher, key), `${higher} must hold ${key} because ${lower} does`).toBe(true);
      }
    }
  });

  test("a viewer holds no action at all — read-only means exactly that", () => {
    expect(ROLE_PERMISSIONS.viewer.size).toBe(0);
  });

  test("a member works inside boards and touches no structure", () => {
    const holds = (key: PermissionKey) => roleHas("member", key);

    expect(holds("row.create")).toBe(true);
    expect(holds("row.update")).toBe(true);
    expect(holds("row.move")).toBe(true);
    expect(holds("comment.create")).toBe(true);
    expect(holds("file.upload")).toBe(true);

    expect(holds("board.column.create")).toBe(false);
    expect(holds("board.column.delete")).toBe(false);
    expect(holds("board.manage")).toBe(false);
    expect(holds("workspace.member.manage")).toBe(false);
    expect(holds("document.update")).toBe(false);
  });

  test("a manager owns the structure, a member does not", () => {
    for (const key of ["board.column.create", "board.manage", "node.archive", "document.update"] as const) {
      expect(roleHas("manager", key)).toBe(true);
      expect(roleHas("member", key)).toBe(false);
    }
  });

  test("only an admin manages the workspace, its access and its secrets", () => {
    for (const key of [
      "workspace.manage",
      "workspace.member.manage",
      "workspace.permission.manage",
      "workspace.audit.view",
      "secret.reveal",
      "secret.rotate",
    ] as const) {
      expect(minimumRoleFor(key)).toBe("admin");
    }
  });

  test("every key is reachable by some role", () => {
    for (const key of PERMISSION_KEYS) {
      expect(minimumRoleFor(key), key).not.toBeNull();
    }
  });
});

describe("can()", () => {
  test("answers from the matrix when nothing narrows it", () => {
    expect(can("row.update", { role: "member", user: CURRENT_USER })).toBe(true);
    expect(can("row.update", { role: "viewer", user: CURRENT_USER })).toBe(false);
  });

  /**
   * Two questions, and `can` only answers the second. Whether a restricted node
   * is reachable at all is resolved before this, by the visibility engine — so
   * a role is never a way past a folder somebody deliberately shut.
   */
  test("restriction is not something can() decides", () => {
    const restricted: DriveNode = {
      ...node(ID.payment),
      accessMode: "restricted",
      owner: memberAt(3),
    };

    expect(can("board.export", { role: "admin", user: CURRENT_USER, node: restricted })).toBe(true);
    expect(can("board.export", { role: "viewer", user: memberAt(3), node: restricted })).toBe(false);
    expect(can("row.update", { role: "member", user: memberAt(3), node: restricted })).toBe(true);
  });

  test("narrowing layers only ever remove — a freeze cannot hand anything back", () => {
    const base = { user: CURRENT_USER, node: node(ID.roadmap) } as const;

    for (const key of PERMISSION_KEYS) {
      for (const role of WORKSPACE_ROLES) {
        const open = can(key, { ...base, role });
        expect(can(key, { ...base, role, isFrozen: true }) && !open, key).toBe(false);
        expect(can(key, { ...base, role, isLocked: true }) && !open, key).toBe(false);
      }
    }
  });

  test("a trashed node accepts nothing but the call that ends it", () => {
    const trashed: DriveNode = { ...node(ID.payment), isTrashed: true };
    const resolve = resolverFor({ role: "admin", user: CURRENT_USER, node: trashed });

    expect(resolve("node.delete")).toBe(true);
    expect(resolve("node.rename")).toBe(false);
    expect(resolve("file.upload")).toBe(false);
  });

  test("a node archived in its own right can still be restored", () => {
    // `isFrozen` counts ancestors only. A board that is archived itself must
    // keep `node.archive`, or nothing could ever be un-archived — and the
    // surface wraps its own resolver, so the two answers have to differ.
    const archived: DriveNode = { ...node(ID.roadmap), isArchived: true };
    const open = resolverFor({ role: "manager", user: CURRENT_USER, node: archived });
    const surface = frozenResolver(open);

    expect(open("node.archive")).toBe(true);
    expect(surface("node.archive")).toBe(false);
    expect(surface("row.update")).toBe(false);
    expect(surface("board.export")).toBe(true);
  });

  test("ownership escalates a fixed, small set of keys and no others", () => {
    const owned: DriveNode = { ...node(ID.payment), owner: CURRENT_USER };
    const asMember = resolverFor({ role: "member", user: CURRENT_USER, node: owned });

    expect(asMember("node.delete")).toBe(true);
    expect(asMember("node.archive")).toBe(true);
    // Owning a folder does not make you a manager of the boards inside it.
    expect(asMember("board.column.create")).toBe(false);
    expect(asMember("workspace.audit.view")).toBe(false);
  });
});

/**
 * The rule the PRD is most emphatic about: no component decides anything from
 * a role. This walks the source rather than trusting that nobody will, because
 * the next scattered check is one refactor away and nothing else would catch it.
 */
describe("no role checks outside the permission library", () => {
  const ROOT = fileURLToPath(new URL("../src", import.meta.url));
  // `lib/workspace-access` joins the exemption: the "a workspace never loses
  // its last admin" rule is *about* a specific role, and there is nowhere more
  // central to put it than the membership library itself.
  const ALLOWED = [
    "lib/permissions",
    "lib/workspace-access.ts",
    "types/permission.ts",
    "mock/users.ts",
  ];
  const PATTERN = /\brole\s*[=!]==?\s*["']|["'](?:admin|manager|member|viewer)["']\s*===?\s*\brole\b/;

  function walk(directory: string): readonly string[] {
    return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
      const full = join(directory, entry.name);
      if (entry.isDirectory()) return walk(full);
      return entry.name.endsWith(".ts") || entry.name.endsWith(".tsx") ? [full] : [];
    });
  }

  test("nothing under src compares a role to a literal", () => {
    const offenders = walk(ROOT)
      .map((file) => relative(ROOT, file))
      .filter((file) => !ALLOWED.some((allowed) => file.startsWith(allowed)))
      .filter((file) => PATTERN.test(readFileSync(join(ROOT, file), "utf8")));

    expect(offenders).toEqual([]);
  });
});
