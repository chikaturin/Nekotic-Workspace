import { describe, expect, test } from "vitest";
import {
  buildHref,
  childCount,
  collectNodes,
  findNodeById,
  findPathToId,
  flattenTree,
  hrefForNode,
  insertNode,
  isDescendantOf,
  moveNode,
  pathLabel,
  removeNode,
  resolvePath,
  searchNodes,
  sortNodes,
  totalSize,
  updateNode,
} from "@/lib/tree";
import { childrenOf, isContainer } from "@/types";
import { buildTestTree, ID } from "./helpers";

describe("lookups", () => {
  test("finds a node nested several levels deep", () => {
    const tree = buildTestTree();

    const found = findNodeById(tree, ID.payment);

    expect(found?.name).toBe("Payment");
  });

  test("returns null when the id does not exist", () => {
    expect(findNodeById(buildTestTree(), "missing")).toBeNull();
  });

  test("builds the full ancestor chain for a node", () => {
    const path = findPathToId(buildTestTree(), ID.payment);

    expect(path.map((node) => node.name)).toEqual(["Development", "Backend", "Payment"]);
  });

  test("path label lists ancestors without the node itself", () => {
    expect(pathLabel(buildTestTree(), ID.payment)).toBe("Development / Backend");
  });

  test("path label falls back to the workspace root for top-level nodes", () => {
    expect(pathLabel(buildTestTree(), ID.development)).toBe("Workspace root");
  });
});

describe("resolvePath", () => {
  test("resolves a multi-segment slug path to its node and children", () => {
    const tree = buildTestTree();

    const location = resolvePath(tree, ["development", "backend", "payment"]);

    expect(location.isNotFound).toBe(false);
    expect(location.node?.id).toBe(ID.payment);
    expect(location.ancestors.map((node) => node.name)).toEqual(["Development", "Backend"]);
    expect(location.children).toHaveLength(2);
  });

  test("returns the workspace root for an empty segment list", () => {
    const location = resolvePath(buildTestTree(), []);

    expect(location.node).toBeNull();
    expect(location.children).toHaveLength(2);
  });

  test("flags unknown segments while keeping what resolved", () => {
    const location = resolvePath(buildTestTree(), ["development", "ghost"]);

    expect(location.isNotFound).toBe(true);
    expect(location.node?.name).toBe("Development");
  });

  test("builds hrefs from a resolved path", () => {
    const tree = buildTestTree();
    const path = findPathToId(tree, ID.payment);

    expect(buildHref(path)).toBe("/drive/development/backend/payment");
    expect(buildHref([])).toBe("/drive");
    expect(hrefForNode(tree, ID.spec)).toBe("/drive/development/backend/payment/spec-pdf");
  });
});

describe("immutable mutations", () => {
  test("updateNode returns a new tree and leaves the original untouched", () => {
    const tree = buildTestTree();

    const next = updateNode(tree, ID.payment, (node) => ({ ...node, name: "Payments" }));

    expect(findNodeById(next, ID.payment)?.name).toBe("Payments");
    expect(findNodeById(tree, ID.payment)?.name).toBe("Payment");
    expect(next).not.toBe(tree);
  });

  test("updateNode keeps untouched branches referentially equal", () => {
    const tree = buildTestTree();

    const next = updateNode(tree, ID.payment, (node) => ({ ...node, isFavorite: false }));

    expect(findNodeById(next, ID.frontend)).toBe(findNodeById(tree, ID.frontend));
  });

  test("removeNode detaches the node and reports it back", () => {
    const tree = buildTestTree();

    const { tree: pruned, removed } = removeNode(tree, ID.payment);

    expect(removed?.name).toBe("Payment");
    expect(findNodeById(pruned, ID.payment)).toBeNull();
    expect(findNodeById(tree, ID.payment)).not.toBeNull();
  });

  test("removeNode is a no-op for an unknown id", () => {
    const tree = buildTestTree();

    const result = removeNode(tree, "missing");

    expect(result.removed).toBeNull();
    expect(result.tree).toBe(tree);
  });

  test("insertNode appends into the requested container", () => {
    const tree = buildTestTree();
    const spec = findNodeById(tree, ID.spec);
    if (!spec) throw new Error("fixture missing");

    const next = insertNode(tree, ID.frontend, { ...spec, id: "copy", parentId: ID.frontend });

    expect(childCount(findNodeById(next, ID.frontend)!)).toBe(1);
  });

  test("insertNode with a null parent appends at the root", () => {
    const tree = buildTestTree();
    const spec = findNodeById(tree, ID.spec)!;

    const next = insertNode(tree, null, { ...spec, id: "copy", parentId: null });

    expect(next).toHaveLength(tree.length + 1);
  });
});

describe("moveNode", () => {
  test("moves a folder into another container and rewrites its parent", () => {
    const tree = buildTestTree();

    const result = moveNode(tree, ID.payment, ID.frontend);

    expect(result.rejection).toBeNull();
    expect(result.moved?.parentId).toBe(ID.frontend);
    expect(childCount(findNodeById(result.tree, ID.frontend)!)).toBe(1);
    expect(childCount(findNodeById(result.tree, ID.backend)!)).toBe(1);
  });

  test("moves a node to the workspace root", () => {
    const tree = buildTestTree();

    const result = moveNode(tree, ID.payment, null);

    expect(result.rejection).toBeNull();
    expect(result.tree).toHaveLength(tree.length + 1);
  });

  test("rejects dropping a folder onto itself", () => {
    const tree = buildTestTree();

    expect(moveNode(tree, ID.payment, ID.payment).rejection).toBe("into-self");
  });

  test("rejects dropping a folder into its own descendant", () => {
    const tree = buildTestTree();

    const result = moveNode(tree, ID.backend, ID.payment);

    expect(result.rejection).toBe("into-descendant");
    expect(result.tree).toBe(tree);
  });

  test("rejects a move that would not change anything", () => {
    const tree = buildTestTree();

    expect(moveNode(tree, ID.payment, ID.backend).rejection).toBe("same-parent");
  });

  test("rejects a leaf node as a destination", () => {
    const tree = buildTestTree();

    expect(moveNode(tree, ID.payment, ID.roadmap).rejection).toBe("invalid-target");
  });

  test("rejects an unknown source", () => {
    expect(moveNode(buildTestTree(), "missing", ID.frontend).rejection).toBe("invalid-target");
  });

  test("isDescendantOf walks the whole subtree", () => {
    const tree = buildTestTree();

    expect(isDescendantOf(tree, ID.development, ID.spec)).toBe(true);
    expect(isDescendantOf(tree, ID.frontend, ID.spec)).toBe(false);
    expect(isDescendantOf(tree, "missing", ID.spec)).toBe(false);
  });
});

describe("aggregation and ordering", () => {
  test("totalSize sums every file below a container", () => {
    const tree = buildTestTree();

    expect(totalSize(findNodeById(tree, ID.payment)!)).toBe(3_000);
    expect(totalSize(findNodeById(tree, ID.frontend)!)).toBe(0);
  });

  test("flattenTree visits every node once", () => {
    expect(flattenTree(buildTestTree())).toHaveLength(8);
  });

  test("sorting by name keeps containers and leaves interleaved alphabetically", () => {
    const tree = buildTestTree();
    const children = childrenOf(findNodeById(tree, ID.backend)!);

    const sorted = sortNodes(children, { key: "name", direction: "asc" });

    expect(sorted.map((node) => node.name)).toEqual(["Payment", "Roadmap"]);
  });

  test("sorting by size groups containers before leaves", () => {
    const tree = buildTestTree();
    const children = childrenOf(findNodeById(tree, ID.development)!);

    const sorted = sortNodes(children, { key: "size", direction: "desc" });

    expect(sorted.every((node) => isContainer(node))).toBe(true);
    expect(sorted[0]?.name).toBe("Backend");
  });

  test("sorting never mutates the input array", () => {
    const tree = buildTestTree();
    const children = childrenOf(findNodeById(tree, ID.backend)!);

    sortNodes(children, { key: "name", direction: "desc" });

    expect(children[0]?.name).toBe("Payment");
  });
});

describe("search and collection", () => {
  test("finds nodes by case-insensitive substring", () => {
    const hits = searchNodes(buildTestTree(), "pay", 10);

    expect(hits.map((hit) => hit.node.name)).toContain("Payment");
    expect(hits[0]?.href).toContain("/drive/development/backend");
  });

  test("excludes trashed nodes from search", () => {
    expect(searchNodes(buildTestTree(), "notes", 10)).toHaveLength(0);
  });

  test("returns nothing for an empty query", () => {
    expect(searchNodes(buildTestTree(), "   ", 10)).toHaveLength(0);
  });

  test("respects the result limit", () => {
    expect(searchNodes(buildTestTree(), "e", 2)).toHaveLength(2);
  });

  test("collectNodes flattens by predicate", () => {
    const favorites = collectNodes(buildTestTree(), (node) => node.isFavorite);

    expect(favorites.map((node) => node.name)).toEqual(["Payment"]);
  });
});
