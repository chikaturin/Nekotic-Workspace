import { beforeEach, describe, expect, test } from "vitest";
import { CURRENT_USER, MEMBERS } from "@/mock/users";
import { boardService } from "@/services/board-service";
import { searchService } from "@/services/search-service";
import { resetSimulation } from "@/services/simulation";
import { usePermissionStore } from "@/store/permission-store";
import {
  getActiveTree,
  getFullTree,
  selectMyWorkspaces,
  selectTree,
  selectWorkspaceAccess,
  useWorkspaceStore,
} from "@/store/workspace-store";
import { flattenTree, findNodeById, updateNode } from "@/lib/tree";
import { buildTestTree, ID, TEST_WORKSPACE, testWorkspace } from "./helpers";
import type { AccessRule, DriveNode } from "@/types";

/**
 * Workspace lifecycle and access, through the store the app actually uses.
 *
 * The unit tests beside this one prove the rules. This one proves they are
 * *wired*: that the tree every surface reads is the filtered one, that creating
 * a workspace makes you its admin, and that losing access takes the data with
 * it rather than leaving it on screen.
 */

const state = () => useWorkspaceStore.getState();

function mount(tree: readonly DriveNode[] = buildTestTree()) {
  useWorkspaceStore.setState({
    workspaces: [TEST_WORKSPACE],
    activeWorkspaceId: TEST_WORKSPACE.id,
    treeByWorkspace: { [TEST_WORKSPACE.id]: tree },
    trashByWorkspace: { [TEST_WORKSPACE.id]: [] },
    selectedIds: [],
    expandedIds: [],
    feedback: null,
    seed: 0,
  });
  usePermissionStore.setState({ rulesByWorkspace: {}, previewRole: null, seed: 0 });
}

/**
 * Mark one node restricted, in the stored tree.
 *
 * The owner is moved to somebody else first. An owner is always admitted to
 * their own folder — the standing guarantee that nothing can be locked beyond
 * reach — and half the fixture is owned by the signed-in user, so leaving it
 * alone would test the escape hatch rather than the restriction.
 */
function restrict(nodeId: string, grantedTo: readonly string[] = []) {
  useWorkspaceStore.setState((current) => ({
    treeByWorkspace: {
      ...current.treeByWorkspace,
      [TEST_WORKSPACE.id]: updateNode(
        current.treeByWorkspace[TEST_WORKSPACE.id] ?? [],
        nodeId,
        (node) => ({ ...node, owner: { ...node.owner, id: "usr_somebody_else" } }),
      ),
    },
  }));

  state().setNodeAccessMode(nodeId, "restricted");

  const rules: AccessRule[] = grantedTo.map((userId, index) => ({
    id: `acl_${index}`,
    nodeId,
    subject: { kind: "user", userId },
    role: "member",
    grantedAt: "2026-01-01T00:00:00.000Z",
    grantedBy: CURRENT_USER.id,
  }));

  usePermissionStore.setState({
    rulesByWorkspace: { [TEST_WORKSPACE.id]: { [nodeId]: rules } },
  });
}

const visibleNames = () => flattenTree(selectTree(state())).map((node) => node.name);

beforeEach(() => {
  resetSimulation();
  boardService.reset();
  mount();
});

describe("creating a workspace", () => {
  test("makes the creator its admin and switches to it", () => {
    const created = state().createWorkspace(
      { name: "NexDrop Development", description: "Dev." },
      CURRENT_USER,
    );

    const workspace = state().workspaces.find((item) => item.id === created);

    expect(workspace?.members).toEqual([
      expect.objectContaining({ id: CURRENT_USER.id, role: "admin" }),
    ]);
    expect(state().activeWorkspaceId).toBe(created);
    expect(selectWorkspaceAccess(state()).isAllowed).toBe(true);
  });

  test("appears in the switcher straight away, and starts empty", () => {
    const created = state().createWorkspace({ name: "Workspace C" }, CURRENT_USER);

    expect(selectMyWorkspaces(state()).map((item) => item.id)).toContain(created);
    expect(selectTree(state())).toHaveLength(0);
  });

  test("carries no other workspace's tree into it", () => {
    state().createWorkspace({ name: "Fresh" }, CURRENT_USER);

    expect(getFullTree()).toHaveLength(0);
    expect(state().selectedIds).toHaveLength(0);
  });
});

describe("the switcher lists only what you are in", () => {
  test("a workspace you are not a member of is absent from the list", () => {
    useWorkspaceStore.setState({
      workspaces: [
        TEST_WORKSPACE,
        { ...testWorkspace("ws_b", "Workspace B"), members: [] },
        testWorkspace("ws_c", "Workspace C"),
      ],
    });

    const mine = selectMyWorkspaces(state()).map((item) => item.name);

    expect(mine).toEqual(["Test workspace", "Workspace C"]);
    expect(mine).not.toContain("Workspace B");
  });

  test("its URL is refused rather than loaded", () => {
    useWorkspaceStore.setState({
      workspaces: [TEST_WORKSPACE, { ...testWorkspace("ws_b", "Workspace B"), members: [] }],
      // As if a stale link or a restored session had put it in context.
      activeWorkspaceId: "ws_b",
      treeByWorkspace: { ws_b: buildTestTree() },
    });

    expect(selectWorkspaceAccess(state()).isAllowed).toBe(false);
    // Not merely hidden by a screen — there is no tree to render.
    expect(selectTree(state())).toHaveLength(0);
    expect(getActiveTree()).toHaveLength(0);
  });
});

describe("membership changes", () => {
  test("removing yourself takes the workspace and its tree away at once", () => {
    state().removeMember(TEST_WORKSPACE.id, CURRENT_USER.id);

    expect(selectMyWorkspaces(state())).toHaveLength(0);
    expect(selectTree(state())).toHaveLength(0);
  });

  test("removing somebody else leaves your own view alone", () => {
    const other = MEMBERS.find((member) => member.id !== CURRENT_USER.id);
    state().removeMember(TEST_WORKSPACE.id, other?.id ?? "");

    expect(selectMyWorkspaces(state())).toHaveLength(1);
    expect(visibleNames()).toContain("Development");
  });

  test("leaving is removing yourself, and lands the same way", () => {
    state().leaveWorkspace(TEST_WORKSPACE.id, CURRENT_USER.id);

    expect(selectWorkspaceAccess(state()).isAllowed).toBe(false);
  });

  test("deleting a workspace falls back to one you actually hold", () => {
    const second = testWorkspace("ws_second", "Second");
    useWorkspaceStore.setState({
      workspaces: [TEST_WORKSPACE, second],
      treeByWorkspace: { [TEST_WORKSPACE.id]: buildTestTree(), ws_second: [] },
    });

    state().deleteWorkspace(TEST_WORKSPACE.id);

    expect(state().activeWorkspaceId).toBe("ws_second");
    expect(state().workspaces).toHaveLength(1);
    expect(state().treeByWorkspace[TEST_WORKSPACE.id]).toBeUndefined();
  });
});

describe("a restricted folder, through the store", () => {
  test("disappears from the tree every surface reads", () => {
    expect(visibleNames()).toContain("Payment");

    // Restricted, and granted to somebody who is not the signed-in user. The
    // fixture's owner is a member, so the owner escape hatch is not in play.
    restrict(ID.payment, ["usr_nobody"]);

    expect(visibleNames()).not.toContain("Payment");
    // Its children go with it, not just the folder.
    expect(visibleNames()).not.toContain("spec.pdf");
    // And the rest of the drive is untouched.
    expect(visibleNames()).toContain("Backend");
  });

  test("is still in the stored tree, so an admin can reopen it", () => {
    restrict(ID.payment, ["usr_nobody"]);

    expect(findNodeById(getFullTree(), ID.payment)).not.toBeNull();
    expect(findNodeById(selectTree(state()), ID.payment)).toBeNull();
  });

  test("granting it back puts it and its subtree straight back", () => {
    restrict(ID.payment, ["usr_nobody"]);
    expect(visibleNames()).not.toContain("Payment");

    restrict(ID.payment, ["usr_nobody", CURRENT_USER.id]);
    expect(visibleNames()).toContain("Payment");
    expect(visibleNames()).toContain("spec.pdf");
  });

  test("global search returns nothing from inside it", async () => {
    restrict(ID.payment, ["usr_nobody"]);

    const groups = await searchService.search({
      query: "spec",
      role: "admin",
      user: CURRENT_USER,
    });

    const titles = groups.flatMap((group) => group.results.map((result) => result.title));
    expect(titles).not.toContain("spec.pdf");
  });

  test("a board inside it cannot be opened by its own id", async () => {
    restrict(ID.backend, ["usr_nobody"]);

    // The board is a descendant of Backend; the service resolves through the
    // filtered tree, so there is nothing to load rather than something to hide.
    await expect(boardService.getBoard(ID.roadmap)).rejects.toThrow();
  });
});

describe("moving something into a restricted folder", () => {
  test("says how many people it was just taken away from", () => {
    restrict(ID.payment, [CURRENT_USER.id]);
    state().moveNode(ID.frontend, ID.payment);

    expect(state().feedback?.message).toContain("can no longer see it");
  });

  test("an ordinary move says nothing of the sort", () => {
    state().moveNode(ID.frontend, ID.backend);

    expect(state().feedback?.message).not.toContain("no longer see");
  });
});
