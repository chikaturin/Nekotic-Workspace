import { describe, expect, test } from "vitest";
import {
  accessModeOf,
  canSeeNode,
  grantedSubjectsOn,
  hasGrantOn,
  isRestricted,
  keepVisibleRefs,
  moveVisibilityImpact,
  nodeVisibility,
  restrictedNodesOf,
  visibleTree,
  wouldLockOut,
  type RulesByNode,
  type VisibilityInput,
} from "@/lib/permissions/visibility";
import { flattenTree } from "@/lib/tree";
import type {
  AccessRule,
  AccessSubject,
  DriveNode,
  FileNode,
  FolderNode,
  NodeAccessMode,
  UserSummary,
  WorkspaceMember,
  WorkspaceRole,
} from "@/types";

/**
 * Folder access control.
 *
 * The property under test throughout, and the reason this file is separate
 * from `rbac.test.ts`: **resource access is not capability**. A Manager who is
 * not granted a restricted folder does not see it; a Viewer who is granted one
 * does. Nothing here asks what anybody may *do*.
 */

const OWNER: UserSummary = { id: "usr_owner", name: "Owner", email: "o@x.io", initials: "OW" };

const PEOPLE = {
  thanh: { id: "usr_thanh", name: "Thanh", email: "t@x.io", initials: "TH" },
  nam: { id: "usr_nam", name: "Nam", email: "n@x.io", initials: "NA" },
  minh: { id: "usr_minh", name: "Minh", email: "m@x.io", initials: "MI" },
  an: { id: "usr_an", name: "An", email: "a@x.io", initials: "AN" },
} as const;

const MEMBERS: readonly WorkspaceMember[] = [
  { ...OWNER, role: "admin", joinedAt: "2026-01-01T00:00:00.000Z" },
  { ...PEOPLE.thanh, role: "member", joinedAt: "2026-01-01T00:00:00.000Z" },
  // Deliberately the highest non-admin role: the point is that it buys nothing.
  { ...PEOPLE.nam, role: "manager", joinedAt: "2026-01-01T00:00:00.000Z" },
  { ...PEOPLE.minh, role: "viewer", joinedAt: "2026-01-01T00:00:00.000Z" },
  { ...PEOPLE.an, role: "member", joinedAt: "2026-01-01T00:00:00.000Z" },
];

function folder(
  id: string,
  name: string,
  children: readonly DriveNode[] = [],
  accessMode?: NodeAccessMode,
): FolderNode {
  return {
    id,
    name,
    slug: id,
    parentId: null,
    workspaceId: "ws",
    owner: OWNER,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    isFavorite: false,
    isTrashed: false,
    isShared: false,
    type: "folder",
    children,
    ...(accessMode ? { accessMode } : {}),
  };
}

/** A leaf, so the same rules can be tested on something that holds nothing. */
function file(id: string, name: string, accessMode?: NodeAccessMode): FileNode {
  return {
    id,
    name,
    slug: id,
    parentId: null,
    workspaceId: "ws",
    owner: OWNER,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    isFavorite: false,
    isTrashed: false,
    isShared: false,
    type: "file",
    kind: "other",
    extension: "env",
    mimeType: "text/plain",
    sizeBytes: 128,
    version: 1,
    ...(accessMode ? { accessMode } : {}),
  };
}

function roleRule(nodeId: string, role: WorkspaceRole): AccessRule {
  return {
    id: `acl_${nodeId}_role_${role}`,
    nodeId,
    subject: { kind: "role", role },
    role,
    grantedAt: "2026-01-01T00:00:00.000Z",
    grantedBy: OWNER.id,
  };
}

function rule(nodeId: string, userId: string, role: WorkspaceRole = "member"): AccessRule {
  return {
    id: `acl_${nodeId}_${userId}`,
    nodeId,
    subject: { kind: "user", userId },
    role,
    grantedAt: "2026-01-01T00:00:00.000Z",
    grantedBy: OWNER.id,
  };
}

function input(tree: readonly DriveNode[], rules: RulesByNode = {}, isMember = true): VisibilityInput {
  return { tree, rules, members: MEMBERS, isMember };
}

const as = (id: string): AccessSubject => ({ kind: "user", userId: id });

const sees = (view: VisibilityInput, nodeId: string, userId: string): boolean =>
  canSeeNode(view, nodeId, as(userId));

const namesIn = (nodes: readonly DriveNode[]): readonly string[] =>
  flattenTree(nodes).map((node) => node.name);

/* ------------------------------------------------------------------ basics */

describe("access modes", () => {
  test("a node with nothing set inherits", () => {
    expect(accessModeOf(folder("f", "Folder"))).toBe("inherit");
    expect(isRestricted(folder("f", "Folder"))).toBe(false);
  });

  test("nothing is visible to somebody who is not in the workspace", () => {
    const tree = [folder("public", "Public")];
    const view = input(tree, {}, false);

    expect(visibleTree(view, as(PEOPLE.thanh.id))).toHaveLength(0);
    expect(sees(view, "public", PEOPLE.thanh.id)).toBe(false);
  });
});

/* -------------------------------------------------------------- restricted */

describe("a restricted folder", () => {
  // Workspace: Thanh, Nam, An, Minh. Finance is restricted to Thanh and Minh.
  const tree = [
    folder("finance", "Finance", [folder("q3", "Q3 numbers")], "restricted"),
    folder("marketing", "Marketing"),
  ];

  const rules: RulesByNode = {
    finance: [rule("finance", PEOPLE.thanh.id), rule("finance", PEOPLE.minh.id, "viewer")],
  };

  const view = input(tree, rules);

  test("is visible to the people granted it", () => {
    expect(sees(view, "finance", PEOPLE.thanh.id)).toBe(true);
    expect(sees(view, "finance", PEOPLE.minh.id)).toBe(true);
  });

  /** The heart of it: a Manager's role is not a way in. */
  test("is invisible to everybody else, whatever role they hold", () => {
    expect(sees(view, "finance", PEOPLE.nam.id)).toBe(false);
    expect(sees(view, "finance", PEOPLE.an.id)).toBe(false);
  });

  test("takes its whole subtree with it — no bypass through a child URL", () => {
    expect(sees(view, "q3", PEOPLE.thanh.id)).toBe(true);
    expect(sees(view, "q3", PEOPLE.nam.id)).toBe(false);
  });

  test("is absent from the tree, not merely marked in it", () => {
    expect(namesIn(visibleTree(view, as(PEOPLE.nam.id)))).toEqual(["Marketing"]);
    expect(namesIn(visibleTree(view, as(PEOPLE.thanh.id)))).toContain("Finance");
  });

  test("the rest of the workspace is unaffected for the people shut out", () => {
    expect(sees(view, "marketing", PEOPLE.nam.id)).toBe(true);
    expect(sees(view, "marketing", PEOPLE.an.id)).toBe(true);
  });

  test("the refusal knows which folder did it, for the caller's own bookkeeping", () => {
    expect(nodeVisibility(view, "q3", as(PEOPLE.nam.id)).deniedAt).toMatchObject({
      nodeId: "finance",
    });
  });

  test("its owner is always in, so a folder can never be locked beyond reach", () => {
    expect(sees(view, "finance", OWNER.id)).toBe(true);
    expect(hasGrantOn(rules, tree[0] as DriveNode, as(OWNER.id), MEMBERS)).toBe(true);
  });
});

/* ------------------------------------------------------------- inheritance */

describe("inheritance", () => {
  /** Finance restricted to Thanh; Reports inherits and says nothing itself. */
  const tree = [
    folder("finance", "Finance", [folder("reports", "Reports")], "restricted"),
  ];
  const view = input(tree, { finance: [rule("finance", PEOPLE.thanh.id)] });

  test("a child that inherits follows its parent without being configured", () => {
    expect(sees(view, "reports", PEOPLE.thanh.id)).toBe(true);
    expect(sees(view, "reports", PEOPLE.nam.id)).toBe(false);
  });

  test("nothing is copied down — the child holds no rule of its own", () => {
    expect(grantedSubjectsOn(view.rules, "reports")).toHaveLength(0);
  });
});

describe("override", () => {
  /**
   * Backend is open to Thanh, Nam and Minh; Payroll inside it is shut to
   * everybody but Thanh. Depth wins over breadth.
   */
  const tree = [
    folder(
      "backend",
      "Backend",
      [folder("payroll", "Payroll", [folder("slips", "Slips")], "restricted")],
      "restricted",
    ),
  ];

  const view = input(tree, {
    backend: [
      rule("backend", PEOPLE.thanh.id),
      rule("backend", PEOPLE.nam.id),
      rule("backend", PEOPLE.minh.id),
    ],
    payroll: [rule("payroll", PEOPLE.thanh.id)],
  });

  test("a child can take back what its parent gave", () => {
    expect(sees(view, "backend", PEOPLE.nam.id)).toBe(true);
    expect(sees(view, "payroll", PEOPLE.nam.id)).toBe(false);
    expect(sees(view, "slips", PEOPLE.nam.id)).toBe(false);
  });

  test("the person on both lists keeps the whole chain", () => {
    expect(sees(view, "slips", PEOPLE.thanh.id)).toBe(true);
  });

  test("Nam still sees Backend itself, and its tree stops at Payroll", () => {
    expect(namesIn(visibleTree(view, as(PEOPLE.nam.id)))).toEqual(["Backend"]);
  });
});

describe("reopening a folder", () => {
  /**
   * Access gates the *path*, not the node.
   *
   * A folder inside one you cannot see stays out of reach even when it declares
   * itself open, because a tree cannot render a child whose parent is missing —
   * showing it would either orphan it or leak the name of the folder it sits in.
   * All-members therefore widens from the folder it is set on downwards, and
   * cannot punch back up through a restriction above it.
   */
  const tree = [
    folder("finance", "Finance", [folder("open", "Open again", [], "workspace")], "restricted"),
    folder("public", "Public", [folder("shared", "Shared", [], "workspace")]),
  ];
  const view = input(tree, { finance: [rule("finance", PEOPLE.thanh.id)] });

  test("all-members cannot reopen a path through a folder you cannot see", () => {
    expect(sees(view, "finance", PEOPLE.nam.id)).toBe(false);
    expect(sees(view, "open", PEOPLE.nam.id)).toBe(false);
  });

  test("but it does open a folder whose path is reachable", () => {
    expect(sees(view, "shared", PEOPLE.nam.id)).toBe(true);
    expect(sees(view, "open", PEOPLE.thanh.id)).toBe(true);
  });

  /** Switching a folder back to all-members is how a restriction is undone. */
  test("switching a restricted folder to all-members gives it back to everybody", () => {
    const reopened = input(
      [folder("finance", "Finance", [folder("q3", "Q3")], "workspace")],
      { finance: [rule("finance", PEOPLE.thanh.id)] },
    );

    expect(sees(reopened, "finance", PEOPLE.nam.id)).toBe(true);
    expect(sees(reopened, "q3", PEOPLE.an.id)).toBe(true);
  });
});

/* ---------------------------------------------------------------- managing */

describe("managing access", () => {
  const finance = folder("finance", "Finance", [], "restricted");
  const tree = [finance, folder("marketing", "Marketing")];

  test("restricting would shut out anybody with no grant — including the actor", () => {
    const view = input(tree, {});

    expect(wouldLockOut(view, finance, as(PEOPLE.thanh.id))).toBe(true);
    // The owner is never locked out, which is the standing safety net.
    expect(wouldLockOut(view, finance, as(OWNER.id))).toBe(false);
  });

  test("a grant written on the folder settles it", () => {
    const view = input(tree, { finance: [rule("finance", PEOPLE.thanh.id)] });
    expect(wouldLockOut(view, finance, as(PEOPLE.thanh.id))).toBe(false);
  });

  /** The admin recovery list: names and paths, never content. */
  test("every restricted folder is listed for recovery, visible or not", () => {
    const listed = restrictedNodesOf(tree);

    expect(listed.map((node) => node.name)).toEqual(["Finance"]);
    // It reads the stored tree directly — it is not filtered by anybody's access.
    expect(listed).not.toBe(visibleTree(input(tree, {}), as(PEOPLE.nam.id)));
  });

  test("a grant naming a role admits everybody who holds it", () => {
    const view = input(tree, {
      finance: [
        {
          id: "acl_role",
          nodeId: "finance",
          subject: { kind: "role", role: "manager" },
          role: "manager",
          grantedAt: "2026-01-01T00:00:00.000Z",
          grantedBy: OWNER.id,
        },
      ],
    });

    // Nam is the manager; nobody else holds that role.
    expect(sees(view, "finance", PEOPLE.nam.id)).toBe(true);
    expect(sees(view, "finance", PEOPLE.thanh.id)).toBe(false);
  });
});

/* ------------------------------------------------------------------ moving */

describe("moving something into a restricted folder", () => {
  const tree = [
    folder("finance", "Finance", [], "restricted"),
    folder("public", "Public", [folder("board", "Board")]),
  ];
  const view = input(tree, { finance: [rule("finance", PEOPLE.thanh.id)] });
  const board = folder("board", "Board");

  test("says who stops being able to see it", () => {
    const impact = moveVisibilityImpact(view, board, "finance");

    expect(impact.losing).toContain(PEOPLE.nam.id);
    expect(impact.losing).toContain(PEOPLE.an.id);
    expect(impact.losing).not.toContain(PEOPLE.thanh.id);
  });

  test("a node with a mode of its own carries it, so nothing shifts", () => {
    const pinned = folder("board", "Board", [], "workspace");
    expect(moveVisibilityImpact(view, pinned, "finance").losing).toHaveLength(0);
  });

  test("moving back out says who gets it again", () => {
    const inside = input(
      [folder("finance", "Finance", [folder("board", "Board")], "restricted"), folder("public", "Public")],
      { finance: [rule("finance", PEOPLE.thanh.id)] },
    );

    expect(moveVisibilityImpact(inside, board, "public").gaining.length).toBeGreaterThan(0);
  });
});

/* ---------------------------------------------------- stale denormalisation */

describe("entries that outlive the access that made them", () => {
  const tree = [folder("public", "Public"), folder("finance", "Finance", [], "restricted")];
  const view = input(tree, { finance: [rule("finance", PEOPLE.thanh.id)] });

  /**
   * Recent, Favourites and the inbox all copy the *name* of what they point at.
   * Left alone, the entry outlives the access and the stale label is the leak.
   */
  test("a history entry pointing at something now hidden is dropped, name and all", () => {
    const history = [
      { ref: { nodeId: "public" }, label: "Public" },
      { ref: { nodeId: "finance" }, label: "Finance" },
    ];

    const forNam = keepVisibleRefs(
      history,
      visibleTree(view, as(PEOPLE.nam.id)),
      (entry) => entry.ref.nodeId,
    );

    expect(forNam.map((entry) => entry.label)).toEqual(["Public"]);
  });

  test("the same history keeps both for somebody who still holds the folder", () => {
    const forThanh = keepVisibleRefs(
      [{ ref: { nodeId: "public" } }, { ref: { nodeId: "finance" } }],
      visibleTree(view, as(PEOPLE.thanh.id)),
      (entry) => entry.ref.nodeId,
    );

    expect(forThanh).toHaveLength(2);
  });
});

/* ------------------------------------------------------------ performance */

describe("resolution rather than duplication", () => {
  /**
   * A restricted folder with a large subtree writes one field and no rules on
   * anything below it. Access is resolved by walking the chain, so the cost of
   * restricting is independent of how much is inside.
   */
  test("restricting a deep folder writes nothing onto its descendants", () => {
    let deepest: DriveNode = folder("leaf", "Leaf");
    for (let depth = 0; depth < 200; depth += 1) {
      deepest = folder(`node_${depth}`, `Node ${depth}`, [deepest]);
    }

    const tree = [folder("root", "Root", [deepest], "restricted")];
    const view = input(tree, { root: [rule("root", PEOPLE.thanh.id)] });

    expect(Object.keys(view.rules)).toEqual(["root"]);
    expect(sees(view, "leaf", PEOPLE.thanh.id)).toBe(true);
    expect(sees(view, "leaf", PEOPLE.nam.id)).toBe(false);
    expect(visibleTree(view, as(PEOPLE.nam.id))).toHaveLength(0);
  });

  /** A tree with nothing restricted comes back as the same array it went in as. */
  test("pruning nothing returns the tree it was given", () => {
    const tree = [folder("a", "A", [folder("b", "B")])];
    const view = input(tree, {});

    expect(visibleTree(view, as(PEOPLE.nam.id))).toBe(tree);
  });
});

/* ------------------------------------------------------------ one file */

/**
 * Restricting a *leaf*.
 *
 * The commonest thing anyone actually wants to shut is one file — a credentials
 * dump, an `.env`, a signed contract — sitting in a folder full of harmless
 * ones. `accessMode` has always been on the base node type and the walk has
 * always visited every node in the chain; only the menu that wrote it was
 * folders-only. These are the cases that used to be unreachable.
 */
describe("a restricted file", () => {
  const tree = [
    folder("shared", "Shared", [
      file("readme", "readme.md"),
      file("env", ".env.production", "restricted"),
    ]),
  ];

  const rules: RulesByNode = { env: [rule("env", PEOPLE.thanh.id)] };
  const view = input(tree, rules);

  test("a member who is not granted cannot see it, whatever their role", () => {
    expect(sees(view, "env", PEOPLE.an.id)).toBe(false);
    // Manager buys nothing here, exactly as it buys nothing on a folder.
    expect(sees(view, "env", PEOPLE.nam.id)).toBe(false);
  });

  test("a granted member sees it, and its neighbours stay visible to everyone", () => {
    expect(sees(view, "env", PEOPLE.thanh.id)).toBe(true);
    expect(sees(view, "readme", PEOPLE.an.id)).toBe(true);
    expect(sees(view, "shared", PEOPLE.an.id)).toBe(true);
  });

  test("its owner keeps it, so a file cannot be shut away from the person who put it there", () => {
    expect(sees(view, "env", OWNER.id)).toBe(true);
  });

  test("the pruned tree drops the file and nothing else", () => {
    expect(namesIn(visibleTree(view, as(PEOPLE.an.id)))).toEqual(["Shared", "readme.md"]);
    expect(namesIn(visibleTree(view, as(PEOPLE.thanh.id)))).toEqual([
      "Shared",
      "readme.md",
      ".env.production",
    ]);
  });

  test("a role-scoped grant admits everyone holding that role", () => {
    const byRole = input(tree, { env: [roleRule("env", "manager")] });

    expect(sees(byRole, "env", PEOPLE.nam.id)).toBe(true);
    expect(sees(byRole, "env", PEOPLE.thanh.id)).toBe(false);
    expect(sees(byRole, "env", PEOPLE.minh.id)).toBe(false);
  });

  /** The refusal names the file itself, not the folder it happens to sit in. */
  test("the denial points at the file, not at its parent", () => {
    expect(nodeVisibility(view, "env", as(PEOPLE.an.id)).deniedAt).toEqual({
      nodeId: "env",
      name: ".env.production",
    });
  });

  test("a restricted file is listed for the admin recovery path", () => {
    expect(restrictedNodesOf(tree).map((node) => node.name)).toEqual([".env.production"]);
  });

  /**
   * A file cannot be reopened from inside itself, so the same lock-out guard a
   * folder gets has to apply here too.
   */
  test("shutting a file you are not granted would lock you out", () => {
    const target = tree[0]!.children[1]!;

    expect(wouldLockOut(view, target, as(PEOPLE.an.id))).toBe(true);
    expect(wouldLockOut(view, target, as(PEOPLE.thanh.id))).toBe(false);
    expect(wouldLockOut(view, target, as(OWNER.id))).toBe(false);
  });
});
