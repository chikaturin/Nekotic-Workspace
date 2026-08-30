import { TREES_BY_WORKSPACE } from "@/mock/tree";
import { childrenOf, type DriveNode } from "@/types";

function collect(
  nodes: readonly DriveNode[],
  prefix: readonly string[],
  found: Set<string>,
): void {
  for (const node of nodes) {
    const path = [...prefix, node.slug];
    found.add(path.join("/"));
    collect(childrenOf(node), path, found);
  }
}

export function nodePathChains(): readonly (readonly string[])[] {
  const found = new Set<string>();
  for (const tree of Object.values(TREES_BY_WORKSPACE)) collect(tree, [], found);
  return [[], ...[...found].sort().map((path) => path.split("/"))];
}
