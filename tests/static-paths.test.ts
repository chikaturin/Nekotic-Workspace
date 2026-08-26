import { describe, expect, test } from "vitest";
import { DRIVE_ROOT_PATH } from "@/config/app";
import { nodePathChains } from "@/lib/static-paths";
import { hrefForNode, resolvePath } from "@/lib/tree";
import { TREES_BY_WORKSPACE } from "@/mock/tree";
import { childrenOf, type DriveNode } from "@/types";

const chains = nodePathChains();
const routes = new Set(chains.map((chain) => `${DRIVE_ROOT_PATH}/${chain.join("/")}`));

function everyNode(nodes: readonly DriveNode[]): readonly DriveNode[] {
  return nodes.flatMap((node) => [node, ...everyNode(childrenOf(node))]);
}

describe("static export paths", () => {
  test("includes the root route so /drive and /files are prerendered", () => {
    // Arrange / Act
    const first = chains[0];

    // Assert
    expect(first).toEqual([]);
  });

  test("every link the app can build for a node is prerendered", () => {
    // Arrange
    const missing: string[] = [];

    // Act
    for (const tree of Object.values(TREES_BY_WORKSPACE)) {
      for (const node of everyNode(tree)) {
        const href = hrefForNode(tree, node.id);
        if (!routes.has(href)) missing.push(href);
      }
    }

    // Assert — a miss here is a hard 404 on the static host.
    expect(missing).toEqual([]);
  });

  test("every prerendered chain resolves in some workspace tree", () => {
    // Arrange
    const trees = Object.values(TREES_BY_WORKSPACE);
    const dangling: string[] = [];

    // Act
    for (const chain of chains) {
      if (chain.length === 0) continue;
      const resolves = trees.some((tree) => !resolvePath(tree, chain).isNotFound);
      if (!resolves) dangling.push(chain.join("/"));
    }

    // Assert — no page should be built for a path nothing points at.
    expect(dangling).toEqual([]);
  });

  test("lists no duplicate chains", () => {
    // Arrange / Act
    const keys = chains.map((chain) => chain.join("/"));

    // Assert
    expect(new Set(keys).size).toBe(keys.length);
  });
});
